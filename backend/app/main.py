from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.v1.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.lifespan import lifespan
from app.services.local_event_photo_storage import (
    DEV_EVENT_PHOTOS_URL_PREFIX,
    event_photos_upload_dir,
    is_local_event_photo_storage_enabled,
)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

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
