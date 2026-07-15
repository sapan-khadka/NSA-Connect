from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryUploadError,
    CloudinaryUploadResult,
    upload_receipt,
)

ALLOWED_RECEIPT_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    }
)
ALLOWED_IMAGE_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)
MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024
TASK_PHOTO_FOLDER = "nsa-connect/task-photos"


class ReceiptValidationError(Exception):
    pass


class ReceiptUploadUnavailableError(Exception):
    pass


def validate_receipt_file(*, content_type: str | None, size_bytes: int) -> None:
    if size_bytes <= 0:
        raise ReceiptValidationError("Receipt file is empty")

    if size_bytes > MAX_RECEIPT_SIZE_BYTES:
        raise ReceiptValidationError("Receipt file exceeds 10 MB limit")

    if content_type not in ALLOWED_RECEIPT_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_RECEIPT_CONTENT_TYPES))
        raise ReceiptValidationError(
            f"Unsupported receipt file type. Allowed types: {allowed}"
        )


def upload_finance_receipt(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryUploadResult:
    validate_receipt_file(content_type=content_type, size_bytes=len(file_bytes))

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise ReceiptUploadUnavailableError()

    try:
        return upload_receipt(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=settings.CLOUDINARY_RECEIPTS_FOLDER,
        )
    except CloudinaryUploadError:
        raise


def validate_image_file(*, content_type: str | None, size_bytes: int) -> None:
    if size_bytes <= 0:
        raise ReceiptValidationError("Image file is empty")

    if size_bytes > MAX_RECEIPT_SIZE_BYTES:
        raise ReceiptValidationError("Image file exceeds 10 MB limit")

    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        allowed = ", ".join(sorted(ALLOWED_IMAGE_CONTENT_TYPES))
        raise ReceiptValidationError(
            f"Unsupported image file type. Allowed types: {allowed}"
        )


def upload_task_photo(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryUploadResult:
    validate_image_file(content_type=content_type, size_bytes=len(file_bytes))

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise ReceiptUploadUnavailableError()

    try:
        return upload_receipt(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=TASK_PHOTO_FOLDER,
        )
    except CloudinaryUploadError:
        raise


def upload_member_document(
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> CloudinaryUploadResult:
    """
    Member documents reuse finance receipt validation and Cloudinary upload
    (JPEG/PNG/WebP/PDF, 10 MB) with a dedicated folder.
    """
    validate_receipt_file(content_type=content_type, size_bytes=len(file_bytes))

    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise ReceiptUploadUnavailableError()

    try:
        return upload_receipt(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            file_bytes=file_bytes,
            folder=settings.CLOUDINARY_MEMBER_DOCUMENTS_FOLDER,
        )
    except CloudinaryUploadError:
        raise
