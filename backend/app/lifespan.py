import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.services.discussion_ws_manager import discussion_connection_manager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s [%s]", settings.APP_NAME, settings.ENVIRONMENT)

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    logger.info("Database connection verified")
    yield
    await discussion_connection_manager.aclose()
    engine.dispose()
    logger.info("Shutdown complete")
