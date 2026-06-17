from fastapi import FastAPI

from app.api.v1.health import router as health_router

app = FastAPI(title="NSA Connect API")

app.include_router(health_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "NSA Connect API running"}
