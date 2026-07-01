from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryUploadError,
    CloudinaryEventPhotoResult,
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
MAX_EVENT_PHOTO_SIZE_BYTES = 15 * 1024 * 1024


class EventPhotoValidationError(Exception):
    pass


class EventPhotoUploadUnavailableError(Exception):
    pass


def validate_event_photo_file(*, content_type: str | None, size_bytes: int) -> None:
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


def upload_event_photo_file(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryEventPhotoResult:
    validate_event_photo_file(content_type=content_type, size_bytes=len(file_bytes))

    if is_local_event_photo_storage_enabled():
        return upload_local_event_photo(
            file_bytes=file_bytes,
            content_type=content_type,
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
        )
    except CloudinaryUploadError:
        raise
