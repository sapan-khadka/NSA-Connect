"""Process-wide logging configuration.

Uvicorn only configures its own ``uvicorn.*`` loggers, so without this the
``app.*`` records fall through to ``logging.lastResort``, whose level is
WARNING. That silently discards the INFO-level audit trail emitted by
:mod:`app.core.security_events`.
"""

from __future__ import annotations

from logging.config import dictConfig

from app.core.config import settings

_VALID_LEVELS = frozenset(
    {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG", "NOTSET"}
)

_configured = False


def resolve_log_level() -> str:
    level = (settings.LOG_LEVEL or "").strip().upper()
    return level if level in _VALID_LEVELS else "INFO"


def build_logging_config() -> dict:
    return {
        "version": 1,
        # Uvicorn/Celery configure their own loggers before importing us.
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "standard",
            },
        },
        "root": {"handlers": ["console"], "level": resolve_log_level()},
        "loggers": {
            # Audit events must survive a raised root level.
            "app.security": {"level": "INFO", "propagate": True},
        },
    }


def configure_logging(*, force: bool = False) -> None:
    """Install stdout logging for the whole process. Safe to call repeatedly."""
    global _configured
    if _configured and not force:
        return

    dictConfig(build_logging_config())
    _configured = True
