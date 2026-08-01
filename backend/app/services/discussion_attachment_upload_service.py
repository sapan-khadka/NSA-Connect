from dataclasses import dataclass

from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryDiscussionAttachmentResult,
    CloudinaryUploadError,
    upload_discussion_attachment,
)
from app.services.local_discussion_attachment_storage import (
    DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX,
    is_local_discussion_attachment_storage_enabled,
    upload_local_discussion_attachment,
)

ALLOWED_IMAGE_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
    }
)
ALLOWED_VIDEO_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/webm",
    }
)
ALLOWED_FILE_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/x-zip-compressed",
    }
)
ALLOWED_AUDIO_CONTENT_TYPES = frozenset(
    {
        "audio/mpeg",
        "audio/mp4",
        "audio/wav",
        "audio/webm",
        "audio/x-m4a",
    }
)
ALLOWED_DISCUSSION_ATTACHMENT_CONTENT_TYPES = (
    ALLOWED_IMAGE_CONTENT_TYPES
    | ALLOWED_VIDEO_CONTENT_TYPES
    | ALLOWED_FILE_CONTENT_TYPES
    | ALLOWED_AUDIO_CONTENT_TYPES
)

MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 8

DISCUSSION_ATTACHMENTS_FOLDER = "nsa-connect/discussion-attachments"


class DiscussionAttachmentValidationError(Exception):
    pass


class DiscussionAttachmentUploadUnavailableError(Exception):
    pass


@dataclass(frozen=True)
class DiscussionAttachmentUploadResult:
    url: str
    public_id: str
    file_name: str
    content_type: str
    size_bytes: int
    kind: str
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None


def normalize_content_type(content_type: str | None) -> str:
    return (content_type or "").split(";")[0].strip().lower()


def attachment_kind_for_content_type(content_type: str | None) -> str:
    normalized = normalize_content_type(content_type)
    if normalized in ALLOWED_IMAGE_CONTENT_TYPES:
        return "image"
    if normalized in ALLOWED_VIDEO_CONTENT_TYPES:
        return "video"
    if normalized in ALLOWED_AUDIO_CONTENT_TYPES:
        return "audio"
    return "file"


def _max_bytes_for_kind(kind: str) -> int:
    if kind == "image":
        return MAX_IMAGE_SIZE_BYTES
    if kind == "video":
        return MAX_VIDEO_SIZE_BYTES
    if kind == "audio":
        return MAX_AUDIO_SIZE_BYTES
    return MAX_FILE_SIZE_BYTES


def _cloudinary_resource_type(kind: str) -> str:
    if kind == "image":
        return "image"
    if kind == "video":
        return "video"
    return "raw"


def validate_discussion_attachment_file(
    *,
    content_type: str | None,
    size_bytes: int,
) -> str:
    if size_bytes <= 0:
        raise DiscussionAttachmentValidationError("Attachment file is empty")

    normalized = normalize_content_type(content_type)
    if normalized not in ALLOWED_DISCUSSION_ATTACHMENT_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_DISCUSSION_ATTACHMENT_CONTENT_TYPES))
        raise DiscussionAttachmentValidationError(
            f"Unsupported attachment type. Allowed types: {allowed}"
        )

    kind = attachment_kind_for_content_type(normalized)
    max_bytes = _max_bytes_for_kind(kind)
    if size_bytes > max_bytes:
        label = {
            "image": "15 MB",
            "video": "100 MB",
            "audio": "25 MB",
            "file": "25 MB",
        }.get(kind, "25 MB")
        raise DiscussionAttachmentValidationError(
            f"Attachment exceeds the {label} limit"
        )
    return kind


def upload_discussion_attachment_file(
    *,
    file_bytes: bytes,
    content_type: str | None,
    file_name: str | None = None,
) -> DiscussionAttachmentUploadResult:
    kind = validate_discussion_attachment_file(
        content_type=content_type,
        size_bytes=len(file_bytes),
    )
    normalized_type = normalize_content_type(content_type)
    safe_name = (file_name or "attachment").strip() or "attachment"
    safe_name = safe_name[:512]

    if is_local_discussion_attachment_storage_enabled():
        uploaded = upload_local_discussion_attachment(
            file_bytes=file_bytes,
            content_type=normalized_type,
            file_name=safe_name,
        )
    else:
        uploaded = _upload_to_cloudinary(
            file_bytes=file_bytes,
            kind=kind,
        )

    duration_ms = None
    if uploaded.duration_seconds is not None:
        duration_ms = int(round(uploaded.duration_seconds * 1000))

    return DiscussionAttachmentUploadResult(
        url=uploaded.url,
        public_id=uploaded.public_id,
        file_name=safe_name,
        content_type=normalized_type,
        size_bytes=uploaded.bytes,
        kind=kind,
        width=uploaded.width,
        height=uploaded.height,
        duration_ms=duration_ms,
    )


def _upload_to_cloudinary(
    *,
    file_bytes: bytes,
    kind: str,
) -> CloudinaryDiscussionAttachmentResult:
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise DiscussionAttachmentUploadUnavailableError()

    try:
        return upload_discussion_attachment(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=DISCUSSION_ATTACHMENTS_FOLDER,
            resource_type=_cloudinary_resource_type(kind),
        )
    except CloudinaryUploadError:
        raise


def is_allowed_attachment_url(url: str) -> bool:
    cleaned = (url or "").strip()
    if not cleaned:
        return False
    if cleaned.startswith(DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX):
        return True
    if cleaned.startswith("/api/v1/dev-uploads/"):
        return True
    cloud_name = (settings.CLOUDINARY_CLOUD_NAME or "").strip()
    if cloud_name and cleaned.startswith(
        f"https://res.cloudinary.com/{cloud_name}/"
    ):
        return True
    return False
