"""Global API rate-limit middleware."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.rate_limit import (
    AppRateLimitExceeded,
    enforce_global_rate_limit,
)

_GLOBAL_RATE_LIMIT_EXEMPT_PREFIXES = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        path = request.url.path

        if path == "/" or any(
            path.startswith(prefix) for prefix in _GLOBAL_RATE_LIMIT_EXEMPT_PREFIXES
        ):
            return await call_next(request)

        if path.startswith("/dev-event-photos"):
            return await call_next(request)

        try:
            enforce_global_rate_limit(request)
        except AppRateLimitExceeded as exc:
            return JSONResponse(status_code=429, content={"detail": exc.detail})

        return await call_next(request)
