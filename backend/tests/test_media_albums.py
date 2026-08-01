from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.integrations.cloudinary_client import CloudinaryEventPhotoResult
from app.models.event import Event, EventType
from app.models.media_album import MediaAlbum, MediaAlbumItem
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
    return create_board_member(db_session, email="board-media@semo.edu")


@pytest.fixture
def board_member_headers(client, board_member):
    return auth_header(client, email="board-media@semo.edu", password="securepass123")


@pytest.fixture
def past_event(db_session, board_member):
    event = Event(
        title="Dashain 2020",
        description="Past event for media album merge tests.",
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


@contextmanager
def patch_upload_media_album_item():
    with patch(
        "app.services.media_album_service.upload_event_photo_file"
    ) as mock_upload:
        mock_upload.return_value = CloudinaryEventPhotoResult(
            image_url="https://res.cloudinary.com/test/image/upload/v1/album-photo.jpg",
            thumbnail_url=(
                "https://res.cloudinary.com/test/image/upload/c_fill,w_400/album-photo.jpg"
            ),
            public_id="nsa-connect/event-photos/album-photo",
            bytes=128,
            format="jpg",
            media_kind="photo",
        )
        yield mock_upload


def test_member_can_create_custom_media_album(client, general_member_headers):
    response = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Picnic snaps"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "custom"
    assert body["title"] == "Picnic snaps"
    assert body["photo_count"] == 0
    assert body["starts_at"] is None
    assert body["event_type"] is None


def test_member_can_upload_to_custom_album(
    client,
    db_session,
    general_member_headers,
):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Upload me"},
    )
    album_id = create.json()["id"]

    with patch_upload_media_album_item():
        response = client.post(
            f"/api/v1/media/albums/{album_id}/items",
            headers=general_member_headers,
            files={"file": ("party.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["album_id"] == album_id
    assert body["image_url"].startswith("https://res.cloudinary.com/")
    assert body["media_kind"] == "photo"

    detail = client.get(
        f"/api/v1/media/albums/{album_id}",
        headers=general_member_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["total"] == 1
    assert detail.json()["photo_count"] == 1


def test_unified_list_includes_custom_and_event_albums(
    client,
    general_member_headers,
    past_event,
):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Standalone"},
    )
    assert create.status_code == 201
    custom_id = create.json()["id"]

    response = client.get("/api/v1/media/albums", headers=general_member_headers)
    assert response.status_code == 200
    body = response.json()
    kinds = {album["kind"] for album in body["albums"]}
    assert "custom" in kinds
    assert "event" in kinds
    custom = next(album for album in body["albums"] if album["kind"] == "custom")
    event = next(album for album in body["albums"] if album["kind"] == "event")
    assert custom["id"] == custom_id
    assert custom["title"] == "Standalone"
    assert event["id"] == past_event.id
    assert event["title"] == "Dashain 2020"


def test_creator_can_delete_custom_album(
    client,
    db_session,
    general_member_headers,
):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Temporary"},
    )
    album_id = create.json()["id"]

    response = client.delete(
        f"/api/v1/media/albums/{album_id}",
        headers=general_member_headers,
    )
    assert response.status_code == 204
    assert db_session.get(MediaAlbum, album_id) is None


def test_other_member_cannot_delete_custom_album(
    client,
    db_session,
    general_member_headers,
    board_member_headers,
):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Mine"},
    )
    album_id = create.json()["id"]

    register_member(
        client, email="other-media@semo.edu", student_id="33445566"
    )
    set_member_approved(db_session, email="other-media@semo.edu")
    other_headers = auth_header(
        client, email="other-media@semo.edu", password="securepass123"
    )

    denied = client.delete(
        f"/api/v1/media/albums/{album_id}",
        headers=other_headers,
    )
    assert denied.status_code == 403

    allowed = client.delete(
        f"/api/v1/media/albums/{album_id}",
        headers=board_member_headers,
    )
    assert allowed.status_code == 204


def test_member_can_delete_own_album_item(
    client,
    db_session,
    general_member_headers,
):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Items"},
    )
    album_id = create.json()["id"]

    with patch_upload_media_album_item():
        upload = client.post(
            f"/api/v1/media/albums/{album_id}/items",
            headers=general_member_headers,
            files={"file": ("party.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    item_id = upload.json()["id"]

    response = client.delete(
        f"/api/v1/media/albums/{album_id}/items/{item_id}",
        headers=general_member_headers,
    )
    assert response.status_code == 204
    assert (
        db_session.scalar(
            select(MediaAlbumItem).where(MediaAlbumItem.id == item_id)
        )
        is None
    )


def test_creator_can_rename_custom_album(client, general_member_headers):
    create = client.post(
        "/api/v1/media/albums",
        headers=general_member_headers,
        json={"title": "Old name"},
    )
    album_id = create.json()["id"]

    response = client.patch(
        f"/api/v1/media/albums/{album_id}",
        headers=general_member_headers,
        json={"title": "New name"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "New name"
