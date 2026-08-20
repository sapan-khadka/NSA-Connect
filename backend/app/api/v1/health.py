from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.core.database import engine
from app.core.rate_limit import get_rate_limit_redis
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", status_code=200, response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok")


@router.get("/health/ready", status_code=200, response_model=HealthResponse)
def health_ready():
    """Readiness: Postgres and Redis must respond."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc

    try:
        get_rate_limit_redis().ping()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="redis unavailable",
        ) from exc

    return HealthResponse(status="ok")
