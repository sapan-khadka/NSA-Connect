from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.rate_limit import (
    AppRateLimitExceeded,
    rate_limit_message_for_path,
)


async def app_rate_limit_exceeded_handler(
    _request: Request,
    exc: AppRateLimitExceeded,
) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": exc.detail})


async def slowapi_rate_limit_exceeded_handler(
    request: Request,
    _exc: RateLimitExceeded,
) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": rate_limit_message_for_path(request.url.path)},
    )
