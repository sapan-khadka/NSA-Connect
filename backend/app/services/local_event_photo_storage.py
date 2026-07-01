import uuid
from pathlib import Path

from app.core.config import settings
from app.integrations.cloudinary_client import CloudinaryEventPhotoResult

LOCAL_EVENT_PHOTO_PUBLIC_ID_PREFIX = "local-dev/event-photos"
DEV_EVENT_PHOTOS_URL_PREFIX = "/api/v1/dev-uploads/event-photos"

_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
}


def event_photos_upload_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "dev_uploads" / "event_photos"


def is_local_event_photo_storage_enabled() -> bool:
    if not settings.is_development:
        return False
    return not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def is_local_event_photo_public_id(public_id: str) -> bool:
    return public_id.startswith(f"{LOCAL_EVENT_PHOTO_PUBLIC_ID_PREFIX}/")


def resolve_event_photo_fetch_url(url: str) -> str:
    if url.startswith("/"):
        return f"{settings.DEV_UPLOAD_BASE_URL.rstrip('/')}{url}"
    return url


def upload_local_event_photo(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryEventPhotoResult:
    extension = _extension_for_content_type(content_type)
    filename = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = event_photos_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    file_path.write_bytes(file_bytes)

    url_path = f"{DEV_EVENT_PHOTOS_URL_PREFIX}/{filename}"
    return CloudinaryEventPhotoResult(
        image_url=url_path,
        thumbnail_url=url_path,
        public_id=f"{LOCAL_EVENT_PHOTO_PUBLIC_ID_PREFIX}/{filename}",
        bytes=len(file_bytes),
        format=extension,
    )


def delete_local_event_photo(public_id: str) -> None:
    if not is_local_event_photo_public_id(public_id):
        return

    filename = Path(public_id.removeprefix(f"{LOCAL_EVENT_PHOTO_PUBLIC_ID_PREFIX}/")).name
    if not filename or filename in {".", ".."}:
        return

    file_path = event_photos_upload_dir() / filename
    if file_path.is_file():
        file_path.unlink()


def _extension_for_content_type(content_type: str | None) -> str:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    return _CONTENT_TYPE_EXTENSIONS.get(normalized_type, "jpg")
