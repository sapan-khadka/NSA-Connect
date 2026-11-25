from dataclasses import dataclass

import cloudinary
import cloudinary.uploader
import cloudinary.utils

# Public CDN delivery (event photos, avatars, task photos).
DELIVERY_TYPE_UPLOAD = "upload"
# Requires a signature / auth token to fetch — use for member PII.
DELIVERY_TYPE_AUTHENTICATED = "authenticated"

DEFAULT_SIGNED_URL_TTL_SECONDS = 3600


class CloudinaryUploadError(Exception):
    pass


@dataclass(frozen=True)
class CloudinaryUploadResult:
    receipt_url: str
    public_id: str
    bytes: int
    format: str | None
    resource_type: str
    delivery_type: str = DELIVERY_TYPE_UPLOAD


@dataclass(frozen=True)
class CloudinaryEventPhotoResult:
    image_url: str
    thumbnail_url: str
    public_id: str
    bytes: int
    format: str | None
    media_kind: str = "photo"
    duration_seconds: int | None = None


@dataclass(frozen=True)
class CloudinaryDiscussionAttachmentResult:
    url: str
    public_id: str
    bytes: int
    format: str | None
    resource_type: str
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None


def _configure(*, cloud_name: str, api_key: str, api_secret: str) -> None:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


def is_authenticated_cloudinary_url(url: str | None) -> bool:
    """True when the stored CDN URL was uploaded as type=authenticated."""
    if not url:
        return False
    return "/authenticated/" in url


def build_signed_delivery_url(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    public_id: str,
    resource_type: str = "image",
    delivery_type: str = DELIVERY_TYPE_AUTHENTICATED,
    expires_in_seconds: int = DEFAULT_SIGNED_URL_TTL_SECONDS,
) -> str:
    """Return a signed URL for an authenticated Cloudinary asset.

    The signature (``s--…--``) is derived from the API secret, so the link is
    not a public CDN path. It does not expire: Cloudinary's expiring
    ``auth_token`` needs a separate token key configured on the account, and
    passing ``auth_token`` without that key raises, which would make every
    private receipt and member document unviewable.

    ``expires_in_seconds`` is accepted for callers and reserved for when a
    token key is configured.
    """
    del expires_in_seconds
    _configure(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)
    try:
        url, _options = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type=resource_type or "image",
            type=delivery_type,
            secure=True,
            sign_url=True,
        )
    except Exception as exc:
        raise CloudinaryUploadError("Failed to sign Cloudinary delivery URL") from exc
    if not url:
        raise CloudinaryUploadError("Cloudinary signed URL was empty")
    return url


def upload_receipt(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    file_bytes: bytes,
    folder: str,
    delivery_type: str = DELIVERY_TYPE_UPLOAD,
) -> CloudinaryUploadResult:
    _configure(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            resource_type="auto",
            type=delivery_type,
            use_filename=True,
            unique_filename=True,
        )
    except Exception as exc:
        raise CloudinaryUploadError("Failed to upload receipt to Cloudinary") from exc

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise CloudinaryUploadError("Cloudinary response missing receipt URL")

    return CloudinaryUploadResult(
        receipt_url=secure_url,
        public_id=public_id,
        bytes=int(result.get("bytes", len(file_bytes))),
        format=result.get("format"),
        resource_type=result.get("resource_type", "image"),
        delivery_type=delivery_type,
    )


def upload_event_photo(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    file_bytes: bytes,
    folder: str,
    media_kind: str = "photo",
) -> CloudinaryEventPhotoResult:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    try:
        if media_kind == "video":
            result = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                resource_type="video",
                use_filename=True,
                unique_filename=True,
            )
        else:
            result = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                resource_type="image",
                use_filename=True,
                unique_filename=True,
                eager=[
                    {
                        "width": 400,
                        "height": 400,
                        "crop": "fill",
                        "quality": "auto",
                        "format": "jpg",
                    }
                ],
                eager_async=False,
            )
    except Exception as exc:
        raise CloudinaryUploadError(
            "Failed to upload event media to Cloudinary"
        ) from exc

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise CloudinaryUploadError("Cloudinary response missing media URL")

    if media_kind == "video":
        thumbnail_url = (
            f"https://res.cloudinary.com/{cloud_name}/video/upload/"
            f"c_fill,w_400,h_400,so_0/{public_id}.jpg"
        )
        duration_raw = result.get("duration")
        duration_seconds = (
            int(round(float(duration_raw))) if duration_raw is not None else None
        )
    else:
        eager = result.get("eager") or []
        thumbnail_url = eager[0].get("secure_url") if eager else secure_url
        duration_seconds = None

    return CloudinaryEventPhotoResult(
        image_url=secure_url,
        thumbnail_url=thumbnail_url,
        public_id=public_id,
        bytes=int(result.get("bytes", len(file_bytes))),
        format=result.get("format"),
        media_kind=media_kind,
        duration_seconds=duration_seconds,
    )


def upload_discussion_attachment(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    file_bytes: bytes,
    folder: str,
    resource_type: str = "auto",
) -> CloudinaryDiscussionAttachmentResult:
    """Upload chat attachment bytes (image, video, or raw file)."""
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            resource_type=resource_type,
            use_filename=True,
            unique_filename=True,
        )
    except Exception as exc:
        raise CloudinaryUploadError(
            "Failed to upload discussion attachment to Cloudinary"
        ) from exc

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise CloudinaryUploadError("Cloudinary response missing attachment URL")

    width = result.get("width")
    height = result.get("height")
    duration_raw = result.get("duration")
    duration_seconds = float(duration_raw) if duration_raw is not None else None

    return CloudinaryDiscussionAttachmentResult(
        url=secure_url,
        public_id=public_id,
        bytes=int(result.get("bytes", len(file_bytes))),
        format=result.get("format"),
        resource_type=result.get("resource_type", resource_type),
        width=int(width) if width is not None else None,
        height=int(height) if height is not None else None,
        duration_seconds=duration_seconds,
    )


def delete_cloudinary_asset(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    public_id: str,
    resource_type: str = "image",
    delivery_type: str = DELIVERY_TYPE_UPLOAD,
) -> None:
    _configure(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)

    try:
        cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            type=delivery_type,
        )
    except Exception as exc:
        raise CloudinaryUploadError("Failed to delete asset from Cloudinary") from exc
