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
) -> CloudinaryEventPhotoResult:
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
        raise CloudinaryUploadError("Failed to upload event photo to Cloudinary") from exc

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise CloudinaryUploadError("Cloudinary response missing image URL")

    eager = result.get("eager") or []
    thumbnail_url = eager[0].get("secure_url") if eager else secure_url

    return CloudinaryEventPhotoResult(
        image_url=secure_url,
        thumbnail_url=thumbnail_url,
        public_id=public_id,
        bytes=int(result.get("bytes", len(file_bytes))),
        format=result.get("format"),
    )


def delete_cloudinary_asset(
    *,
    cloud_name: str,
    api_key: str,
    api_secret: str,
    public_id: str,
) -> None:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception as exc:
        raise CloudinaryUploadError("Failed to delete image from Cloudinary") from exc
