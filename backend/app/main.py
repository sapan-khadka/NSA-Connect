from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import IntegrityError

from app.api.v1.discussion_ws import router as discussion_ws_router
from app.api.v1.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import cors_allow_origins, docs_enabled, settings
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
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.services.local_avatar_storage import (
    AvatarKind,
    avatar_upload_dir,
    avatar_url_prefix,
    is_local_avatar_storage_enabled,
)
from app.services.local_discussion_attachment_storage import (
    DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX,
    discussion_attachments_upload_dir,
    is_local_discussion_attachment_storage_enabled,
)
from app.services.local_event_photo_storage import (
    DEV_EVENT_PHOTOS_URL_PREFIX,
    event_photos_upload_dir,
    is_local_event_photo_storage_enabled,
)

_docs = docs_enabled()

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
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
_cors_origins = cors_allow_origins()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
# Outermost so JSON, errors, and CORS responses all get lock-down headers.
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(health_router)
app.include_router(api_router)
app.include_router(discussion_ws_router)

if is_local_event_photo_storage_enabled():
    upload_dir = event_photos_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        DEV_EVENT_PHOTOS_URL_PREFIX,
        StaticFiles(directory=Path(upload_dir)),
        name="dev-event-photos",
    )

if is_local_discussion_attachment_storage_enabled():
    attachment_dir = discussion_attachments_upload_dir()
    attachment_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        DEV_DISCUSSION_ATTACHMENTS_URL_PREFIX,
        StaticFiles(directory=Path(attachment_dir)),
        name="dev-discussion-attachments",
    )

if is_local_avatar_storage_enabled() or is_local_event_photo_storage_enabled():
    for kind, mount_name in (
        (AvatarKind.MEMBER, "dev-member-avatars"),
        (AvatarKind.GROUP, "dev-group-avatars"),
    ):
        avatar_dir = avatar_upload_dir(kind)
        avatar_dir.mkdir(parents=True, exist_ok=True)
        app.mount(
            avatar_url_prefix(kind),
            StaticFiles(directory=Path(avatar_dir)),
            name=mount_name,
        )


@app.get("/")
def root():
    return {"message": "NSA Connect API running"}
