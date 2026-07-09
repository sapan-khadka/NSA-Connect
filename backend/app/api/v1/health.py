import os

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_frontend_url, settings
from app.core.dependencies import require_board
from app.models.member import Member

router = APIRouter(tags=["health"])


@router.get("/health", status_code=200)
def health_check():
    return {"status": "ok"}


@router.get("/health/frontend-url-debug")
def frontend_url_debug(_: Member = Depends(require_board)):
    """Board-only: show how FRONTEND_URL is resolved (temporary debug)."""
    return {
        "frontend_url_os_environ": os.environ.get("FRONTEND_URL"),
        "frontend_url_cached_settings": settings.FRONTEND_URL,
        "frontend_url_fresh_settings": Settings().FRONTEND_URL,
        "frontend_url_used_for_qr": get_frontend_url(),
    }
