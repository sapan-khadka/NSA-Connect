from dataclasses import dataclass

import cloudinary
import cloudinary.uploader


class CloudinaryUploadError(Exception):
    pass


@dataclass(frozen=True)
class CloudinaryUploadResult:
    receipt_url: str
    public_id: str
    bytes: int
    format: str | None
    resource_type: str


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


def upload_receipt(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    file_bytes: bytes,
    folder: str,
) -> CloudinaryUploadResult:
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
            resource_type="auto",
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
) -> None:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception as exc:
        raise CloudinaryUploadError("Failed to delete asset from Cloudinary") from exc
