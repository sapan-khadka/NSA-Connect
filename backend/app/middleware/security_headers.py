"""HTTP security headers for API responses."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import settings

# JSON/API documents should not load scripts or be framed.
API_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)

API_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": API_CONTENT_SECURITY_POLICY,
}

HSTS_HEADER_VALUE = "max-age=31536000; includeSubDomains"


def _request_is_https(request: Request) -> bool:
    forwarded = (request.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip()
    if forwarded:
        return forwarded.lower() == "https"
    return request.url.scheme == "https"


def should_set_hsts(request: Request) -> bool:
    """HSTS only on TLS (or trusted proxy TLS) outside local development."""
    if settings.ENVIRONMENT == "development":
        return False
    if not settings.HSTS_ENABLED:
        return False
    return _request_is_https(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)
        for name, value in API_SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if should_set_hsts(request):
            response.headers.setdefault(
                "Strict-Transport-Security",
                settings.HSTS_HEADER_VALUE or HSTS_HEADER_VALUE,
            )
        return response
