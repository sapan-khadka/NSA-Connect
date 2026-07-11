from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import httpx
import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.integrations.cloudinary_client import CloudinaryEventPhotoResult
from app.models.event import Event, EventType, MeetingVisibility
from app.models.event_photo import EventPhoto
from app.models.member import Member

MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
)


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session, email="board-admin@semo.edu")


@pytest.fixture
def board_member_headers(client, board_member):
    return auth_header(client, email="board-admin@semo.edu", password="securepass123")


@pytest.fixture
def past_event(db_session, board_member):
    event = Event(
        title="Dashain 2020",
        description="Past event for photo archive tests.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2020, 6, 1, 18, tzinfo=UTC),
        budget=Decimal("100.00"),
        show_in_photo_archive=True,
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def _create_photo(
    db_session,
    *,
    event: Event,
    uploader: Member,
    suffix: str,
) -> EventPhoto:
    photo = EventPhoto(
        event_id=event.id,
        uploaded_by_id=uploader.id,
        image_url=f"https://res.cloudinary.com/test/image/upload/v1/photo-{suffix}.jpg",
        thumbnail_url=f"https://res.cloudinary.com/test/image/upload/c_fill,w_400/photo-{suffix}.jpg",
        public_id=f"nsa-connect/event-photos/photo-{suffix}",
    )
    db_session.add(photo)
    db_session.commit()
    db_session.refresh(photo)
    return photo


@contextmanager
def patch_upload_event_photo():
    with patch(
        "app.services.event_photo_upload_service.upload_event_photo"
    ) as mock_upload:
        mock_upload.return_value = CloudinaryEventPhotoResult(
            image_url="https://res.cloudinary.com/test/image/upload/v1/photo.jpg",
            thumbnail_url="https://res.cloudinary.com/test/image/upload/c_fill,w_400/photo.jpg",
            public_id="nsa-connect/event-photos/photo",
            bytes=128,
            format="jpg",
        )
        yield mock_upload


def test_list_photo_albums_returns_past_events_with_cover(
    client,
    db_session,
    general_member_headers,
    past_event,
):
    board = db_session.get(Member, past_event.created_by_id)
    _create_photo(db_session, event=past_event, uploader=board, suffix="1")

    response = client.get(
        "/api/v1/events/photos/albums", headers=general_member_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["albums"][0]["event_id"] == past_event.id
    assert body["albums"][0]["event_name"] == "Dashain 2020"
    assert body["albums"][0]["photo_count"] == 1
    assert body["albums"][0]["cover_thumbnail_url"] is not None


def test_list_photo_albums_includes_visible_past_event_with_zero_photos(
    client,
    general_member_headers,
    past_event,
):
    response = client.get(
        "/api/v1/events/photos/albums", headers=general_member_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["albums"][0]["event_id"] == past_event.id
    assert body["albums"][0]["photo_count"] == 0
    assert body["albums"][0]["cover_thumbnail_url"] is None


def test_list_photo_albums_excludes_past_meeting_when_hidden(
    client,
    db_session,
    general_member_headers,
    board_member,
):
    meeting = Event(
        title="March Board Meeting",
        description="Past board meeting.",
        event_type=EventType.MEETING,
        starts_at=datetime(2020, 5, 1, 18, tzinfo=UTC),
        budget=Decimal("0.00"),
        show_in_photo_archive=False,
        created_by_id=board_member.id,
    )
    db_session.add(meeting)
    db_session.commit()

    response = client.get(
        "/api/v1/events/photos/albums", headers=general_member_headers
    )

    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_patch_show_in_photo_archive_includes_meeting_in_albums(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
    board_member,
):
    meeting = Event(
        title="Social Board Retreat",
        description="Meeting with photos worth sharing.",
        event_type=EventType.MEETING,
        starts_at=datetime(2020, 4, 1, 18, tzinfo=UTC),
        budget=Decimal("0.00"),
        show_in_photo_archive=False,
        meeting_visibility=MeetingVisibility.PUBLIC,
        created_by_id=board_member.id,
    )
    db_session.add(meeting)
    db_session.commit()
    db_session.refresh(meeting)

    patch = client.patch(
        f"/api/v1/events/{meeting.id}",
        json={"show_in_photo_archive": True},
        headers=board_member_headers,
    )
    assert patch.status_code == 200

    response = client.get(
        "/api/v1/events/photos/albums", headers=general_member_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["albums"][0]["event_id"] == meeting.id
    assert body["albums"][0]["photo_count"] == 0


def test_list_photo_albums_includes_upcoming_event_when_visible(
    client,
    db_session,
    general_member_headers,
    board_member,
):
    upcoming = Event(
        title="Tihar",
        description="Upcoming cultural event.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 11, 1, 18, tzinfo=UTC),
        budget=Decimal("100.00"),
        show_in_photo_archive=True,
        created_by_id=board_member.id,
    )
    db_session.add(upcoming)
    db_session.commit()

    response = client.get(
        "/api/v1/events/photos/albums", headers=general_member_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    album_ids = [album["event_id"] for album in body["albums"]]
    assert upcoming.id in album_ids


def test_member_can_upload_event_photo(
    client,
    general_member_headers,
    past_event,
):
    with patch_upload_event_photo():
        response = client.post(
            f"/api/v1/events/{past_event.id}/photos",
            headers=general_member_headers,
            files={"file": ("party.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == past_event.id
    assert body["uploaded_by_name"] == "Sapan Khadka"
    assert body["image_url"].startswith("https://res.cloudinary.com/")


def test_member_can_delete_own_photo(
    client,
    db_session,
    general_member_headers,
    past_event,
):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    photo = _create_photo(db_session, event=past_event, uploader=member, suffix="own")

    response = client.delete(
        f"/api/v1/events/{past_event.id}/photos/{photo.id}",
        headers=general_member_headers,
    )

    assert response.status_code == 204


def test_member_cannot_delete_another_members_photo(
    client,
    db_session,
    general_member_headers,
    past_event,
):
    board = db_session.get(Member, past_event.created_by_id)
    photo = _create_photo(db_session, event=past_event, uploader=board, suffix="other")

    response = client.delete(
        f"/api/v1/events/{past_event.id}/photos/{photo.id}",
        headers=general_member_headers,
    )

    assert response.status_code == 403


def test_board_member_can_delete_any_photo(
    client,
    board_member_headers,
    past_event,
    general_member_headers,
):
    with patch_upload_event_photo():
        upload = client.post(
            f"/api/v1/events/{past_event.id}/photos",
            headers=general_member_headers,
            files={"file": ("party.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    photo_id = upload.json()["id"]

    response = client.delete(
        f"/api/v1/events/{past_event.id}/photos/{photo_id}",
        headers=board_member_headers,
    )

    assert response.status_code == 204


def test_upload_rejects_unsupported_file_type(
    client,
    general_member_headers,
    past_event,
):
    response = client.post(
        f"/api/v1/events/{past_event.id}/photos",
        headers=general_member_headers,
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 422


def test_member_can_download_event_photo_album(
    client,
    db_session,
    general_member_headers,
    past_event,
):
    board = db_session.get(Member, past_event.created_by_id)
    _create_photo(db_session, event=past_event, uploader=board, suffix="zip-a")
    _create_photo(db_session, event=past_event, uploader=board, suffix="zip-b")

    class MockStreamResponse:
        def __init__(self, payload: bytes):
            self._payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def raise_for_status(self):
            return None

        def iter_bytes(self, *, chunk_size: int):
            del chunk_size
            yield self._payload

    class MockClient:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def head(self, _url):
            class Response:
                status_code = 200

                def raise_for_status(self):
                    return None

            return Response()

        def stream(self, _method, _url, headers=None):
            del headers
            return MockStreamResponse(MINIMAL_JPEG)

    with patch(
        "app.services.event_photo_download_service.httpx.Client",
        MockClient,
    ):
        response = client.post(
            f"/api/v1/events/{past_event.id}/photos/download",
            headers=general_member_headers,
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "dashain-2020-photos.zip" in response.headers["content-disposition"]

    import io
    import zipfile

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert sorted(archive.namelist()) == ["photo-0001.jpg", "photo-0002.jpg"]


def test_download_skips_unavailable_photos_and_includes_manifest(
    client,
    db_session,
    general_member_headers,
    past_event,
):
    board = db_session.get(Member, past_event.created_by_id)
    _create_photo(db_session, event=past_event, uploader=board, suffix="good")
    bad = _create_photo(db_session, event=past_event, uploader=board, suffix="bad")

    class MockStreamResponse:
        def __init__(self, payload: bytes):
            self._payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def raise_for_status(self):
            return None

        def iter_bytes(self, *, chunk_size: int):
            del chunk_size
            yield self._payload

    class MockClient:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def head(self, url):
            class Response:
                status_code = 200

                def raise_for_status(self):
                    return None

            if "bad" in url:
                raise httpx.HTTPError("unavailable")
            return Response()

        def stream(self, _method, url, headers=None):
            del headers
            if "bad" in url:
                raise httpx.HTTPError("unavailable")
            return MockStreamResponse(MINIMAL_JPEG)

    with patch(
        "app.services.event_photo_download_service.httpx.Client",
        MockClient,
    ):
        response = client.post(
            f"/api/v1/events/{past_event.id}/photos/download",
            headers=general_member_headers,
        )

    assert response.status_code == 200

    import io
    import zipfile

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert "photo-0001.jpg" in archive.namelist()
    assert "_skipped_photos.txt" in archive.namelist()
    manifest = archive.read("_skipped_photos.txt").decode("utf-8")
    assert str(bad.id) in manifest


def test_member_can_upload_event_photo_using_local_dev_storage(
    client,
    general_member_headers,
    past_event,
    tmp_path,
):
    with (
        patch("app.core.config.settings.CLOUDINARY_CLOUD_NAME", ""),
        patch("app.core.config.settings.CLOUDINARY_API_KEY", ""),
        patch("app.core.config.settings.CLOUDINARY_API_SECRET", ""),
        patch("app.core.config.settings.ENVIRONMENT", "development"),
        patch(
            "app.services.local_event_photo_storage.event_photos_upload_dir",
            return_value=tmp_path,
        ),
    ):
        response = client.post(
            f"/api/v1/events/{past_event.id}/photos",
            headers=general_member_headers,
            files={"file": ("party.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["image_url"].startswith("/api/v1/dev-uploads/event-photos/")
    assert body["thumbnail_url"] == body["image_url"]
    assert body["image_url"].endswith(".jpg")
    saved_files = list(tmp_path.glob("*.jpg"))
    assert len(saved_files) == 1


def test_download_returns_404_when_event_has_no_photos(
    client,
    general_member_headers,
    past_event,
):
    response = client.post(
        f"/api/v1/events/{past_event.id}/photos/download",
        headers=general_member_headers,
    )

    assert response.status_code == 404


def test_board_can_upload_and_clear_event_cover_photo(
    client,
    db_session,
    board_member_headers,
    past_event,
):
    with patch_upload_event_photo():
        upload_response = client.post(
            f"/api/v1/events/{past_event.id}/event-photo",
            headers=board_member_headers,
            files={"file": ("cover.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    assert upload_response.status_code == 200
    upload_body = upload_response.json()
    assert (
        upload_body["event_photo_url"]
        == "https://res.cloudinary.com/test/image/upload/v1/photo.jpg"
    )

    db_session.refresh(past_event)
    assert past_event.event_photo_url == upload_body["event_photo_url"]

    delete_response = client.delete(
        f"/api/v1/events/{past_event.id}/event-photo",
        headers=board_member_headers,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["event_photo_url"] is None

    db_session.refresh(past_event)
    assert past_event.event_photo_url is None


def test_general_member_cannot_upload_event_cover_photo(
    client,
    general_member_headers,
    past_event,
):
    with patch_upload_event_photo():
        response = client.post(
            f"/api/v1/events/{past_event.id}/event-photo",
            headers=general_member_headers,
            files={"file": ("cover.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    assert response.status_code == 403
