"""Logging configuration tests.

Without an explicit config, ``app.security`` INFO records fall through to
``logging.lastResort`` (WARNING) and are silently dropped in production.
"""

import logging

from app.core.config import settings
from app.core.logging_config import (
    build_logging_config,
    configure_logging,
    resolve_log_level,
)


def test_root_logger_writes_to_stdout():
    config = build_logging_config()
    assert config["root"]["handlers"] == ["console"]
    assert config["handlers"]["console"]["stream"] == "ext://sys.stdout"


def test_security_logger_stays_at_info_when_root_is_raised(monkeypatch):
    monkeypatch.setattr(settings, "LOG_LEVEL", "WARNING")
    config = build_logging_config()

    assert config["root"]["level"] == "WARNING"
    assert config["loggers"]["app.security"]["level"] == "INFO"
    assert config["loggers"]["app.security"]["propagate"] is True


def test_existing_loggers_are_not_disabled():
    # Uvicorn and Celery configure their loggers before we import.
    assert build_logging_config()["disable_existing_loggers"] is False


def test_invalid_log_level_falls_back_to_info(monkeypatch):
    monkeypatch.setattr(settings, "LOG_LEVEL", "chatty")
    assert resolve_log_level() == "INFO"

    monkeypatch.setattr(settings, "LOG_LEVEL", "")
    assert resolve_log_level() == "INFO"


def test_log_level_is_case_insensitive(monkeypatch):
    monkeypatch.setattr(settings, "LOG_LEVEL", "debug")
    assert resolve_log_level() == "DEBUG"


def test_configure_logging_emits_security_events_to_stdout(capsys):
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    try:
        configure_logging(force=True)
        logging.getLogger("app.security").info("%s", {"event": "login_success"})
        assert "login_success" in capsys.readouterr().out
    finally:
        # dictConfig replaced root handlers; restore so other tests keep theirs.
        root.handlers[:] = saved_handlers
        root.setLevel(saved_level)
