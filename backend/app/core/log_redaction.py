"""Strip credential query parameters from log lines.

Uvicorn records the request target before the application runs, so a legacy
``?token=`` WebSocket URL would otherwise be copied into the process logs.
"""

from __future__ import annotations

import logging
import re

_QUERY_CREDENTIAL = re.compile(
    r"([?&](?:access_token|refresh_token|ws_token|ticket|token)=)([^&\s\"']+)",
    re.IGNORECASE,
)
_REDACTED = r"\1REDACTED"
_LOGGER_NAMES = ("", "uvicorn", "uvicorn.access", "uvicorn.error")


def redact_credentials(message: str) -> str:
    return _QUERY_CREDENTIAL.sub(_REDACTED, message)


class CredentialRedactionFilter(logging.Filter):
    """Rewrite log messages and their interpolation arguments in place."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_credentials(record.msg)
        args = record.args
        if isinstance(args, tuple):
            record.args = tuple(
                redact_credentials(arg) if isinstance(arg, str) else arg for arg in args
            )
        elif isinstance(args, dict):
            record.args = {
                key: redact_credentials(value) if isinstance(value, str) else value
                for key, value in args.items()
            }
        return True


def install_credential_redaction() -> None:
    """Attach the filter to process and server loggers. Safe to call repeatedly."""
    for name in _LOGGER_NAMES:
        logger = logging.getLogger(name)
        _attach(logger)
        for handler in logger.handlers:
            _attach(handler)


def _attach(target: logging.Logger | logging.Handler) -> None:
    if any(isinstance(item, CredentialRedactionFilter) for item in target.filters):
        return
    target.addFilter(CredentialRedactionFilter())
