"""Shared upload/delete for member and group avatars."""

from __future__ import annotations

from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryEventPhotoResult,
    CloudinaryUploadError,
    delete_cloudinary_asset,
    upload_event_photo,
)
from app.services.event_photo_upload_service import (
    EventPhotoUploadUnavailableError,
    EventPhotoValidationError,
    validate_event_photo_file,
)
from app.services.local_avatar_storage import (
    AvatarKind,
    delete_local_avatar,
    is_local_avatar_public_id,
    is_local_avatar_storage_enabled,
    upload_local_avatar,
)
from app.services.local_event_photo_storage import is_local_event_photo_storage_enabled

# Re-export validation errors so callers can import from one place.
__all__ = [
    "AvatarKind",
    "AvatarUploadUnavailableError",
    "AvatarValidationError",
    "delete_avatar_asset",
    "upload_avatar_file",
]

AvatarValidationError = EventPhotoValidationError
AvatarUploadUnavailableError = EventPhotoUploadUnavailableError


def _cloudinary_folder(kind: AvatarKind) -> str:
    if kind == AvatarKind.MEMBER:
        return settings.CLOUDINARY_MEMBER_AVATARS_FOLDER
    return settings.CLOUDINARY_GROUP_AVATARS_FOLDER


def upload_avatar_file(
    *,
    kind: AvatarKind,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryEventPhotoResult:
    validate_event_photo_file(content_type=content_type, size_bytes=len(file_bytes))

    if is_local_avatar_storage_enabled() or is_local_event_photo_storage_enabled():
        return upload_local_avatar(
            kind=kind,
            file_bytes=file_bytes,
            content_type=content_type,
        )

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise AvatarUploadUnavailableError()

    try:
        return upload_event_photo(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=_cloudinary_folder(kind),
        )
    except CloudinaryUploadError:
        raise


def delete_avatar_asset(*, kind: AvatarKind, public_id: str | None) -> None:
    if not public_id:
        return

    if is_local_avatar_public_id(public_id, kind=kind):
        delete_local_avatar(public_id, kind=kind)
        return

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        return

    try:
        delete_cloudinary_asset(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            public_id=public_id,
            resource_type="image",
        )
    except CloudinaryUploadError:
        # Best-effort cleanup — DB clear still proceeds.
        return
