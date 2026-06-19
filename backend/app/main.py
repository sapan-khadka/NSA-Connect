from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.core.config import settings
from app.lifespan import lifespan

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.include_router(health_router)


@app.get("/")
def root():
    return {"message": "NSA Connect API running"}
