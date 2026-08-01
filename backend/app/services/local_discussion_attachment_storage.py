import uuid
from pathlib import Path

from app.core.config import settings
from app.integrations.cloudinary_client import CloudinaryDiscussionAttachmentResult

LOCAL_DISCUSSION_ATTACHMENT_PUBLIC_ID_PREFIX = "local-dev/discussion-attachments"
DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX = "/api/v1/dev-uploads/discussion-attachments"

_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
}


def discussion_attachments_upload_dir() -> Path:
    return (
        Path(__file__).resolve().parents[2] / "dev_uploads" / "discussion_attachments"
    )


def is_local_discussion_attachment_storage_enabled() -> bool:
    if not settings.is_development:
        return False
    return not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def is_local_discussion_attachment_public_id(public_id: str) -> bool:
    return public_id.startswith(f"{LOCAL_DISCUSSION_ATTACHMENT_PUBLIC_ID_PREFIX}/")


def upload_local_discussion_attachment(
    *,
    file_bytes: bytes,
    content_type: str | None,
    file_name: str | None = None,
) -> CloudinaryDiscussionAttachmentResult:
    extension = _extension_for_content_type(content_type, file_name)
    filename = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = discussion_attachments_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    file_path.write_bytes(file_bytes)

    url_path = f"{DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX}/{filename}"
    return CloudinaryDiscussionAttachmentResult(
        url=url_path,
        public_id=f"{LOCAL_DISCUSSION_ATTACHMENT_PUBLIC_ID_PREFIX}/{filename}",
        bytes=len(file_bytes),
        format=extension,
        resource_type="raw",
        width=None,
        height=None,
        duration_seconds=None,
    )


def _extension_for_content_type(
    content_type: str | None,
    file_name: str | None,
) -> str:
    normalized = (content_type or "").split(";")[0].strip().lower()
    if normalized in _CONTENT_TYPE_EXTENSIONS:
        return _CONTENT_TYPE_EXTENSIONS[normalized]
    if file_name and "." in file_name:
        return file_name.rsplit(".", 1)[-1].lower()[:16] or "bin"
    return "bin"
