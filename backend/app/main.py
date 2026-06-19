from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

app.include_router(health_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "NSA Connect API running"}
