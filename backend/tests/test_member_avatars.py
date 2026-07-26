"""Self-service member profile avatar upload/delete."""

from contextlib import contextmanager
from unittest.mock import patch

from conftest import auth_header, register_member, set_member_approved

from app.integrations.cloudinary_client import CloudinaryEventPhotoResult
from app.models.member import Member

MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
)


@contextmanager
def patch_avatar_upload(*, public_id="nsa-connect/member-avatars/me"):
    with patch("app.services.avatar_upload_service.upload_event_photo") as mock_upload:
        mock_upload.return_value = CloudinaryEventPhotoResult(
            image_url="https://res.cloudinary.com/test/image/upload/v1/avatar.jpg",
            thumbnail_url="https://res.cloudinary.com/test/image/upload/c_fill,w_400/avatar.jpg",
            public_id=public_id,
            bytes=len(MINIMAL_JPEG),
            format="jpg",
        )
        yield mock_upload


def test_member_can_upload_and_delete_own_avatar(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    with patch_avatar_upload(), patch(
        "app.services.avatar_upload_service.delete_cloudinary_asset"
    ):
        uploaded = client.post(
            "/api/v1/members/me/avatar",
            headers=headers,
            files={"file": ("me.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
        assert uploaded.status_code == 200
        body = uploaded.json()
        assert (
            body["avatar_url"]
            == "https://res.cloudinary.com/test/image/upload/v1/avatar.jpg"
        )

        me = client.get("/api/v1/members/me", headers=headers).json()
        member = db_session.get(Member, me["id"])
        assert member is not None
        assert member.avatar_public_id == "nsa-connect/member-avatars/me"

        deleted = client.delete("/api/v1/members/me/avatar", headers=headers)
        assert deleted.status_code == 200
        assert deleted.json()["avatar_url"] is None

        db_session.refresh(member)
        assert member.avatar_url is None
        assert member.avatar_public_id is None


def test_avatar_upload_rejects_invalid_file(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/avatar",
        headers=headers,
        files={"file": ("bad.txt", b"not-an-image", "text/plain")},
    )
    assert response.status_code == 422


def test_me_profile_includes_avatar_url(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    with patch_avatar_upload():
        client.post(
            "/api/v1/members/me/avatar",
            headers=headers,
            files={"file": ("me.jpg", MINIMAL_JPEG, "image/jpeg")},
        )

    me = client.get("/api/v1/members/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["avatar_url"].startswith("https://")
