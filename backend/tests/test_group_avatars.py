"""Group discussion room avatar upload/delete."""

from contextlib import contextmanager
from unittest.mock import patch

from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)

from app.integrations.cloudinary_client import CloudinaryEventPhotoResult

MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
)


@contextmanager
def patch_group_avatar_upload():
    with patch("app.services.avatar_upload_service.upload_event_photo") as mock_upload:
        mock_upload.return_value = CloudinaryEventPhotoResult(
            image_url="https://res.cloudinary.com/test/image/upload/v1/group.jpg",
            thumbnail_url="https://res.cloudinary.com/test/image/upload/c_fill,w_400/group.jpg",
            public_id="nsa-connect/group-avatars/group",
            bytes=len(MINIMAL_JPEG),
            format="jpg",
        )
        yield mock_upload


def _create_live_group(client, db_session) -> tuple[int, dict, dict]:
    create_board_member(db_session)
    create_president_member(db_session)
    board_headers = auth_header(client, email="board@semo.edu")
    president_headers = auth_header(client, email="president@semo.edu")

    created = client.post(
        "/api/v1/discussions/rooms",
        headers=board_headers,
        json={"name": "Decor Crew"},
    ).json()
    room_id = created["id"]
    client.post(
        f"/api/v1/discussions/rooms/{room_id}/approve",
        headers=president_headers,
    )
    return room_id, board_headers, president_headers


def test_owner_can_upload_group_avatar(client, db_session):
    room_id, board_headers, _ = _create_live_group(client, db_session)

    with patch_group_avatar_upload():
        response = client.post(
            f"/api/v1/discussions/rooms/{room_id}/avatar",
            headers=board_headers,
            files={"file": ("group.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    assert response.status_code == 200
    assert (
        response.json()["avatar_url"]
        == "https://res.cloudinary.com/test/image/upload/v1/group.jpg"
    )

    inbox = client.get("/api/v1/discussions/inbox", headers=board_headers)
    match = next(
        room for room in inbox.json()["rooms"] if room["room_id"] == f"room:{room_id}"
    )
    assert match["avatar_url"] == response.json()["avatar_url"]


def test_board_can_upload_group_avatar(client, db_session):
    room_id, _, president_headers = _create_live_group(client, db_session)

    with patch_group_avatar_upload():
        response = client.post(
            f"/api/v1/discussions/rooms/{room_id}/avatar",
            headers=president_headers,
            files={"file": ("group.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    assert response.status_code == 200
    assert response.json()["avatar_url"] is not None


def test_general_member_cannot_upload_group_avatar(client, db_session):
    room_id, _, _ = _create_live_group(client, db_session)
    register_member(client, email="member2@semo.edu", student_id="11223344")
    set_member_approved(db_session, email="member2@semo.edu")
    general = auth_header(client, email="member2@semo.edu")

    with patch_group_avatar_upload():
        response = client.post(
            f"/api/v1/discussions/rooms/{room_id}/avatar",
            headers=general,
            files={"file": ("group.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    assert response.status_code == 404


def test_dm_cannot_set_room_avatar(client, db_session):
    create_board_member(db_session)
    register_member(client)
    set_member_approved(db_session)
    board_headers = auth_header(client, email="board@semo.edu")
    general_headers = auth_header(client)

    me = client.get("/api/v1/members/me", headers=general_headers).json()
    dm = client.post(
        "/api/v1/discussions/dms",
        headers=board_headers,
        json={"member_id": me["id"]},
    ).json()

    with patch_group_avatar_upload():
        response = client.post(
            f"/api/v1/discussions/rooms/{dm['id']}/avatar",
            headers=board_headers,
            files={"file": ("group.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    assert response.status_code == 404


def test_owner_can_delete_group_avatar(client, db_session):
    room_id, board_headers, _ = _create_live_group(client, db_session)

    with patch_group_avatar_upload(), patch(
        "app.services.avatar_upload_service.delete_cloudinary_asset"
    ):
        client.post(
            f"/api/v1/discussions/rooms/{room_id}/avatar",
            headers=board_headers,
            files={"file": ("group.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
        deleted = client.delete(
            f"/api/v1/discussions/rooms/{room_id}/avatar",
            headers=board_headers,
        )
    assert deleted.status_code == 200
    assert deleted.json()["avatar_url"] is None
