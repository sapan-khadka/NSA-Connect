"""Redis-backed rate limiting (slowapi + custom counters for nuanced rules)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import redis
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)

RATE_LIMIT_LOGIN_MESSAGE = "Too many login attempts — please try again in a few minutes"
RATE_LIMIT_REGISTER_MESSAGE = "Too many registration attempts — please try again later"
RATE_LIMIT_CHANGE_PASSWORD_MESSAGE = (
    "Too many password change attempts — please try again in a few minutes"
)
RATE_LIMIT_GUEST_CHECKIN_MESSAGE = (
    "Too many guest check-ins from this device — please try again later"
)
RATE_LIMIT_PASSWORD_RESET_MESSAGE = (
    "Too many password reset requests — please try again later"
)
RATE_LIMIT_RECEIPT_SCAN_MESSAGE = (
    "Too many receipt scans — please try again later"
)
RATE_LIMIT_GLOBAL_MESSAGE = (
    "Too many requests — please slow down and try again in a moment"
)


class AppRateLimitExceeded(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


_redis_client: redis.Redis | None = None


def get_rate_limit_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.rate_limit_storage_uri,
            decode_responses=True,
        )
    return _redis_client


def reset_rate_limit_redis(client: redis.Redis | None = None) -> None:
    """Test helper to swap or clear the Redis client."""
    global _redis_client
    _redis_client = client


def get_client_ip(request: Request) -> str:
    """Derive the client IP for rate-limit buckets.

    By default uses the direct peer address (``request.client.host``), which is
    correct for local development and when the app is exposed directly.

    Set ``RATE_LIMIT_TRUST_PROXY_HEADERS=true`` only when the API runs behind a
    *trusted* reverse proxy that sets ``X-Forwarded-For``. The left-most address
    in that header is used. If this is enabled without a trusted proxy, clients
    can spoof IPs and evade limits.
    """
    if settings.RATE_LIMIT_TRUST_PROXY_HEADERS:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip

    if request.client and request.client.host:
        return request.client.host

    return get_remote_address(request)


def rate_limit_key(request: Request) -> str:
    """slowapi key function — delegates to get_client_ip so tests can patch it."""
    return get_client_ip(request)


def _normalize_email(email: str) -> str:
    return email.lower().strip()


def _increment_fixed_window(key: str, *, limit: int, window_seconds: int) -> bool:
    redis_client = get_rate_limit_redis()
    count = int(redis_client.incr(key))
    if count == 1:
        redis_client.expire(key, window_seconds)
    return count <= limit


def _enforce_fixed_window(
    key: str,
    *,
    limit: int,
    window_seconds: int,
    detail: str,
) -> None:
    if not _increment_fixed_window(key, limit=limit, window_seconds=window_seconds):
        raise AppRateLimitExceeded(detail)


def check_login_account_failures(email: str) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    redis_client = get_rate_limit_redis()
    key = f"rl:login:fail:{_normalize_email(email)}"
    failures = int(redis_client.get(key) or 0)
    if failures >= settings.RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_MAX:
        raise AppRateLimitExceeded(RATE_LIMIT_LOGIN_MESSAGE)


def record_login_failure(email: str) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    redis_client = get_rate_limit_redis()
    key = f"rl:login:fail:{_normalize_email(email)}"
    failures = int(redis_client.incr(key))
    if failures == 1:
        redis_client.expire(
            key,
            settings.RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_WINDOW_SECONDS,
        )


def clear_login_failures(email: str) -> None:
    get_rate_limit_redis().delete(f"rl:login:fail:{_normalize_email(email)}")


def check_password_reset_email_limit(email: str) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return

    from app.services.password_reset_service import PASSWORD_RESET_RATE_LIMIT_MESSAGE

    _enforce_fixed_window(
        f"rl:pwd-reset:email:{_normalize_email(email)}",
        limit=settings.RATE_LIMIT_PASSWORD_RESET_EMAIL_MAX,
        window_seconds=settings.RATE_LIMIT_PASSWORD_RESET_EMAIL_WINDOW_SECONDS,
        detail=PASSWORD_RESET_RATE_LIMIT_MESSAGE,
    )


def enforce_global_rate_limit(request: Request) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    member_id = _optional_member_id(request)
    if member_id is not None:
        key = f"rl:global:user:{member_id}"
    else:
        key = f"rl:global:ip:{get_client_ip(request)}"

    _enforce_fixed_window(
        key,
        limit=settings.RATE_LIMIT_GLOBAL_MAX,
        window_seconds=settings.RATE_LIMIT_GLOBAL_WINDOW_SECONDS,
        detail=RATE_LIMIT_GLOBAL_MESSAGE,
    )


def _optional_member_id(request: Request) -> int | None:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None

    try:
        from app.core.security import decode_access_token

        payload = decode_access_token(token)
    except Exception:
        return None

    member_id = payload.get("member_id")
    if isinstance(member_id, int):
        return member_id
    return None


def change_password_key(request: Request) -> str:
    member_id = _optional_member_id(request)
    if member_id is not None:
        return f"change-password:user:{member_id}"
    return f"change-password:ip:{get_client_ip(request)}"


def receipt_scan_key(request: Request) -> str:
    member_id = _optional_member_id(request)
    if member_id is not None:
        return f"receipt-scan:user:{member_id}"
    return f"receipt-scan:ip:{get_client_ip(request)}"


def guest_checkin_event_key(request: Request) -> str:
    event_id = request.path_params.get("event_id", "unknown")
    return f"guest-checkin:event:{event_id}:ip:{get_client_ip(request)}"


def guest_checkin_global_key(request: Request) -> str:
    return f"guest-checkin:global:ip:{get_client_ip(request)}"


def rate_limit_message_for_path(path: str) -> str:
    if path.endswith("/auth/login"):
        return RATE_LIMIT_LOGIN_MESSAGE
    if path.endswith("/auth/register"):
        return RATE_LIMIT_REGISTER_MESSAGE
    if path.endswith("/members/me/password"):
        return RATE_LIMIT_CHANGE_PASSWORD_MESSAGE
    if path.endswith("/checkin/guest"):
        return RATE_LIMIT_GUEST_CHECKIN_MESSAGE
    if path.endswith("/auth/password-reset/request"):
        return RATE_LIMIT_PASSWORD_RESET_MESSAGE
    if path.endswith("/finance/receipts/scan"):
        return RATE_LIMIT_RECEIPT_SCAN_MESSAGE
    return RATE_LIMIT_GLOBAL_MESSAGE


def build_limiter() -> Limiter:
    return Limiter(
        key_func=rate_limit_key,
        storage_uri=settings.rate_limit_storage_uri,
        headers_enabled=False,
        enabled=settings.RATE_LIMIT_ENABLED,
    )


limiter = build_limiter()


def limit(
    limit_value: str,
    *,
    key_func: Callable[[Request], str] | None = None,
):
    kwargs = {}
    if key_func is not None:
        kwargs["key_func"] = key_func
    return limiter.limit(limit_value, **kwargs)
