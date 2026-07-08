from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import IntegrityError

from app.api.v1.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exception_handlers import (
    exception_group_handler,
    integrity_error_handler,
    unhandled_exception_handler,
)
from app.core.rate_limit import AppRateLimitExceeded, limiter
from app.core.rate_limit_handlers import (
    app_rate_limit_exceeded_handler,
    slowapi_rate_limit_exceeded_handler,
)
from app.core.validation_errors import request_validation_exception_handler
from app.lifespan import lifespan
from app.middleware.global_rate_limit import GlobalRateLimitMiddleware
from app.services.local_event_photo_storage import (
    DEV_EVENT_PHOTOS_URL_PREFIX,
    event_photos_upload_dir,
    is_local_event_photo_storage_enabled,
)
from slowapi.errors import RateLimitExceeded

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(ExceptionGroup, exception_group_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
app.add_exception_handler(AppRateLimitExceeded, app_rate_limit_exceeded_handler)
app.add_exception_handler(RateLimitExceeded, slowapi_rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GlobalRateLimitMiddleware)

app.include_router(health_router)
app.include_router(api_router)

if is_local_event_photo_storage_enabled():
    upload_dir = event_photos_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        DEV_EVENT_PHOTOS_URL_PREFIX,
        StaticFiles(directory=Path(upload_dir)),
        name="dev-event-photos",
    )


@app.get("/")
def root():
    return {"message": "NSA Connect API running"}
