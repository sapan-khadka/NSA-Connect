from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryEventPhotoResult,
    CloudinaryUploadError,
    upload_event_photo,
)
from app.services.local_event_photo_storage import (
    is_local_event_photo_storage_enabled,
    upload_local_event_photo,
)

ALLOWED_EVENT_PHOTO_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/heif",
    }
)
ALLOWED_EVENT_VIDEO_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/webm",
    }
)
ALLOWED_EVENT_MEDIA_CONTENT_TYPES = (
    ALLOWED_EVENT_PHOTO_CONTENT_TYPES | ALLOWED_EVENT_VIDEO_CONTENT_TYPES
)
MAX_EVENT_PHOTO_SIZE_BYTES = 15 * 1024 * 1024
MAX_EVENT_VIDEO_SIZE_BYTES = 100 * 1024 * 1024


class EventPhotoValidationError(Exception):
    pass


class EventPhotoUploadUnavailableError(Exception):
    pass


def media_kind_for_content_type(content_type: str | None) -> str:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type in ALLOWED_EVENT_VIDEO_CONTENT_TYPES:
        return "video"
    return "photo"


def validate_event_photo_file(*, content_type: str | None, size_bytes: int) -> None:
    """Validate photo-only uploads (covers, avatars)."""
    if size_bytes <= 0:
        raise EventPhotoValidationError("Image file is empty")

    if size_bytes > MAX_EVENT_PHOTO_SIZE_BYTES:
        raise EventPhotoValidationError("Image file exceeds 15 MB limit")

    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type not in ALLOWED_EVENT_PHOTO_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_EVENT_PHOTO_CONTENT_TYPES))
        raise EventPhotoValidationError(
            f"Unsupported image file type. Allowed types: {allowed}"
        )


def validate_event_media_file(*, content_type: str | None, size_bytes: int) -> None:
    """Validate album media (photos and videos)."""
    if size_bytes <= 0:
        raise EventPhotoValidationError("Media file is empty")

    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type not in ALLOWED_EVENT_MEDIA_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_EVENT_MEDIA_CONTENT_TYPES))
        raise EventPhotoValidationError(
            f"Unsupported media file type. Allowed types: {allowed}"
        )

    media_kind = media_kind_for_content_type(normalized_type)
    max_bytes = (
        MAX_EVENT_VIDEO_SIZE_BYTES
        if media_kind == "video"
        else MAX_EVENT_PHOTO_SIZE_BYTES
    )
    if size_bytes > max_bytes:
        limit_label = "100 MB" if media_kind == "video" else "15 MB"
        raise EventPhotoValidationError(
            f"Media file exceeds the {limit_label} limit"
        )


def upload_event_photo_file(
    *,
    file_bytes: bytes,
    content_type: str | None,
    cover_only: bool = False,
) -> CloudinaryEventPhotoResult:
    if cover_only:
        validate_event_photo_file(
            content_type=content_type, size_bytes=len(file_bytes)
        )
        media_kind = "photo"
    else:
        validate_event_media_file(content_type=content_type, size_bytes=len(file_bytes))
        media_kind = media_kind_for_content_type(content_type)

    if is_local_event_photo_storage_enabled():
        return upload_local_event_photo(
            file_bytes=file_bytes,
            content_type=content_type,
            media_kind=media_kind,
        )

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise EventPhotoUploadUnavailableError()

    try:
        return upload_event_photo(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=settings.CLOUDINARY_EVENT_PHOTOS_FOLDER,
            media_kind=media_kind,
        )
    except CloudinaryUploadError:
        raise
