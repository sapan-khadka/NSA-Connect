"""Resolve delivery URLs for private Cloudinary assets (member PII).

New member documents and finance receipts upload as ``type=authenticated``.
API responses mint a signed URL (API-secret signature in the path) so the
stored CDN link is not directly fetchable. These signed links do not expire.
Legacy public uploads keep their stored URL.
"""

from __future__ import annotations

import logging

from app.core.config import settings
from app.integrations.cloudinary_client import (
    DELIVERY_TYPE_AUTHENTICATED,
    DELIVERY_TYPE_UPLOAD,
    CloudinaryUploadError,
    build_signed_delivery_url,
    is_authenticated_cloudinary_url,
)

logger = logging.getLogger(__name__)


def _cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def resolve_private_asset_url(
    *,
    stored_url: str | None,
    public_id: str | None,
    resource_type: str | None = "image",
    force_authenticated: bool = False,
) -> str | None:
    """Return a usable browser URL for a stored Cloudinary asset.

    - Authenticated assets (new uploads, or ``force_authenticated``) → signed URL.
    - Legacy public assets → stored URL unchanged.
    - Missing credentials when a signature is required → stored URL (may 401).
    """
    if not stored_url and not public_id:
        return None

    needs_signature = force_authenticated or is_authenticated_cloudinary_url(stored_url)
    if not needs_signature:
        return stored_url

    if not public_id or not _cloudinary_configured():
        return stored_url

    try:
        return build_signed_delivery_url(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            public_id=public_id,
            resource_type=resource_type or "image",
            delivery_type=DELIVERY_TYPE_AUTHENTICATED,
            expires_in_seconds=settings.CLOUDINARY_SIGNED_URL_TTL_SECONDS,
        )
    except CloudinaryUploadError:
        logger.exception("Failed to sign Cloudinary URL for public_id=%s", public_id)
        return stored_url


def cloudinary_delivery_type_for_url(stored_url: str | None) -> str:
    if is_authenticated_cloudinary_url(stored_url):
        return DELIVERY_TYPE_AUTHENTICATED
    return DELIVERY_TYPE_UPLOAD
