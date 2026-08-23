"""Structured security-event logging for auth and abuse signals."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from app.core.rate_limit import get_client_ip

logger = logging.getLogger("app.security")


def log_security_event(
    event: str,
    *,
    request: Request | None = None,
    **fields: Any,
) -> None:
    """Emit a single-line structured security event (no secrets/tokens)."""
    payload: dict[str, Any] = {"event": event}
    if request is not None:
        payload["ip"] = get_client_ip(request)
        payload["path"] = request.url.path
        payload["method"] = request.method
    for key, value in fields.items():
        if value is None:
            continue
        payload[key] = value
    logger.info("%s", payload)
