import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.services.discussion_ws_manager import discussion_connection_manager
from app.services.user_notify_ws_manager import user_notify_connection_manager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s [%s]", settings.APP_NAME, settings.ENVIRONMENT)

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    logger.info("Database connection verified")

    from app.core.database import SessionLocal
    from app.services.organization_context import (
        ensure_default_university_and_org,
        ensure_nsa_org_owner,
    )

    db = SessionLocal()
    try:
        ensure_default_university_and_org(db)
        ensure_nsa_org_owner(db)
    except Exception:
        logger.exception("Tenancy bootstrap skipped or failed")
    finally:
        db.close()

    yield
    await user_notify_connection_manager.aclose()
    await discussion_connection_manager.aclose()
    engine.dispose()
    logger.info("Shutdown complete")
