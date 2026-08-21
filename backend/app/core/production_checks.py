"""Warn or refuse unsafe production configuration at process start."""

from __future__ import annotations

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)

_DEFAULT_DATABASE_URL = (
    "postgresql://postgres:postgres@localhost:5433/nsa_connect"
)
_DEFAULT_REDIS_URL = "redis://localhost:6379/0"
_RESEND_SANDBOX_FROM = "onboarding@resend.dev"


def _looks_like_default_database_url(url: str) -> bool:
    normalized = (url or "").strip().lower()
    if not normalized:
        return True
    return normalized == _DEFAULT_DATABASE_URL.lower() or (
        ("localhost" in normalized or "127.0.0.1" in normalized)
        and "postgres:postgres@" in normalized
    )


def _looks_like_default_redis_url(url: str) -> bool:
    normalized = (url or "").strip().lower()
    if not normalized:
        return True
    return normalized == _DEFAULT_REDIS_URL.lower() or (
        ("localhost" in normalized or "127.0.0.1" in normalized)
        and normalized.startswith("redis://")
    )


def production_config_issues(settings: Settings) -> list[str]:
    """Return fatal production problems, then warnings (warnings last)."""
    return [
        *production_config_fatal_issues(settings),
        *production_config_warnings(settings),
    ]


def production_config_fatal_issues(settings: Settings) -> list[str]:
    """Problems that must refuse boot when ENVIRONMENT=production."""
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
    if not settings.RESEND_API_KEY.strip():
        issues.append("RESEND_API_KEY is required for verification and notification email")
    if not settings.org_owner_email_set:
        issues.append(
            "ORG_OWNER_EMAILS is empty — first SEMO registrant can still bootstrap"
        )
    if not settings.CLOUDINARY_CLOUD_NAME.strip():
        issues.append(
            "CLOUDINARY_CLOUD_NAME is empty — media will use local dev_uploads"
        )
    if _looks_like_default_database_url(settings.DATABASE_URL):
        issues.append(
            "DATABASE_URL still points at the local dev Postgres default"
        )
    if _looks_like_default_redis_url(settings.REDIS_URL):
        issues.append("REDIS_URL still points at the local dev Redis default")
    if _RESEND_SANDBOX_FROM in (settings.RESEND_FROM_EMAIL or "").lower():
        issues.append(
            "RESEND_FROM_EMAIL still uses the Resend sandbox onboarding address"
        )
    return issues


def production_config_warnings(settings: Settings) -> list[str]:
    """Non-fatal production problems (process may still start)."""
    if settings.ENVIRONMENT != "production":
        return []

    warnings: list[str] = []
    if not settings.RATE_LIMIT_TRUST_PROXY_HEADERS:
        warnings.append(
            "RATE_LIMIT_TRUST_PROXY_HEADERS is false — enable it behind Railway/nginx "
            "so rate limits use the real client IP"
        )
    return warnings


def enforce_production_config(settings: Settings) -> None:
    """Log warnings and raise if production config is unsafe."""
    for issue in production_config_warnings(settings):
        logger.warning("Production config: %s", issue)

    fatal = production_config_fatal_issues(settings)
    if not fatal:
        return

    for issue in fatal:
        logger.error("Production config: %s", issue)
    raise RuntimeError("Unsafe production configuration: " + "; ".join(fatal))


def log_production_config_warnings(settings: Settings) -> None:
    """Backward-compatible logger for all production issues (no abort)."""
    for issue in production_config_issues(settings):
        logger.warning("Production config: %s", issue)
