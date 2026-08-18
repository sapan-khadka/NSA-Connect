"""Warn (or refuse) unsafe production configuration at process start."""

from __future__ import annotations

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)


def production_config_issues(settings: Settings) -> list[str]:
    """Return human-readable problems when ENVIRONMENT=production."""
    if settings.ENVIRONMENT != "production":
        return []

    issues: list[str] = []
    if settings.DEBUG:
        issues.append("DEBUG must be false in production")
    secret = (settings.SECRET_KEY or "").strip().lower()
    if len(settings.SECRET_KEY or "") < 32:
        issues.append("SECRET_KEY must be at least 32 characters")
    if any(fragment in secret for fragment in ("dev-only-secret", "change-me")):
        issues.append("SECRET_KEY still looks like the development default")
    if not (settings.FRONTEND_URL or "").startswith("https://"):
        issues.append("FRONTEND_URL should be an https:// public URL")
    if settings.EMAIL_TEST_OVERRIDE_RECIPIENT.strip():
        issues.append("EMAIL_TEST_OVERRIDE_RECIPIENT must be empty in production")
    if settings.SKIP_EMAIL_VERIFICATION:
        issues.append("SKIP_EMAIL_VERIFICATION must be false in production")
    if not settings.EMAIL_ENABLED:
        issues.append("EMAIL_ENABLED should be true so members receive mail")
    if not (
        settings.SENDGRID_API_KEY.strip() or settings.RESEND_API_KEY.strip()
    ):
        issues.append("Configure SENDGRID_API_KEY or RESEND_API_KEY for email")
    if not settings.CLOUDINARY_CLOUD_NAME.strip():
        issues.append(
            "CLOUDINARY_CLOUD_NAME is empty — media will use local dev_uploads"
        )
    if not settings.org_owner_email_set:
        issues.append(
            "ORG_OWNER_EMAILS is empty — first SEMO registrant can still bootstrap"
        )
    return issues


def log_production_config_warnings(settings: Settings) -> None:
    for issue in production_config_issues(settings):
        logger.warning("Production config: %s", issue)
