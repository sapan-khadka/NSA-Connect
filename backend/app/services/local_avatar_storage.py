"""Local-dev storage for member and group avatars (mirrors event photo local path)."""

from __future__ import annotations

import uuid
from enum import StrEnum
from pathlib import Path

from app.core.config import settings
from app.integrations.cloudinary_client import CloudinaryEventPhotoResult

_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
}


class AvatarKind(StrEnum):
    MEMBER = "member"
    GROUP = "group"


_KIND_CONFIG = {
    AvatarKind.MEMBER: {
        "dir_name": "member_avatars",
        "url_prefix": "/api/v1/dev-uploads/member-avatars",
        "public_id_prefix": "local-dev/member-avatars",
    },
    AvatarKind.GROUP: {
        "dir_name": "group_avatars",
        "url_prefix": "/api/v1/dev-uploads/group-avatars",
        "public_id_prefix": "local-dev/group-avatars",
    },
}


def is_local_avatar_storage_enabled() -> bool:
    if not settings.is_development:
        return False
    return not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def avatar_upload_dir(kind: AvatarKind) -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "dev_uploads"
        / _KIND_CONFIG[kind]["dir_name"]
    )


def avatar_url_prefix(kind: AvatarKind) -> str:
    return _KIND_CONFIG[kind]["url_prefix"]


def is_local_avatar_public_id(public_id: str, *, kind: AvatarKind) -> bool:
    prefix = _KIND_CONFIG[kind]["public_id_prefix"]
    return public_id.startswith(f"{prefix}/")


def upload_local_avatar(
    *,
    kind: AvatarKind,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryEventPhotoResult:
    extension = _extension_for_content_type(content_type)
    filename = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = avatar_upload_dir(kind)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    file_path.write_bytes(file_bytes)

    config = _KIND_CONFIG[kind]
    url_path = f"{config['url_prefix']}/{filename}"
    return CloudinaryEventPhotoResult(
        image_url=url_path,
        thumbnail_url=url_path,
        public_id=f"{config['public_id_prefix']}/{filename}",
        bytes=len(file_bytes),
        format=extension,
    )


def delete_local_avatar(public_id: str, *, kind: AvatarKind) -> None:
    if not is_local_avatar_public_id(public_id, kind=kind):
        return

    prefix = _KIND_CONFIG[kind]["public_id_prefix"]
    filename = Path(public_id.removeprefix(f"{prefix}/")).name
    if not filename or filename in {".", ".."}:
        return

    file_path = avatar_upload_dir(kind) / filename
    if file_path.is_file():
        file_path.unlink()


def _extension_for_content_type(content_type: str | None) -> str:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    return _CONTENT_TYPE_EXTENSIONS.get(normalized_type, "jpg")
