"""Global API exception handlers — friendly client messages, detailed server logs."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.safe_messages import GENERIC_CONFLICT_ERROR, GENERIC_SERVER_ERROR

logger = logging.getLogger(__name__)


def _request_context(request: Request) -> dict[str, Any]:
    client_host = request.client.host if request.client else None
    return {
        "method": request.method,
        "path": request.url.path,
        "client_host": client_host,
        "query": str(request.url.query) if request.url.query else None,
    }


async def integrity_error_handler(
    request: Request,
    exc: IntegrityError,
) -> JSONResponse:
    context = _request_context(request)
    logger.exception(
        "Database integrity error on %s %s",
        context["method"],
        context["path"],
        extra={"request_context": context},
    )
    return JSONResponse(
        status_code=409,
        content={"detail": GENERIC_CONFLICT_ERROR},
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    context = _request_context(request)
    logger.exception(
        "Unhandled error on %s %s: %s",
        context["method"],
        context["path"],
        type(exc).__name__,
        extra={"request_context": context},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": GENERIC_SERVER_ERROR},
    )


async def exception_group_handler(
    request: Request,
    exc: BaseExceptionGroup,
) -> JSONResponse:
    context = _request_context(request)
    logger.exception(
        "Unhandled error group on %s %s: %s (%d sub-exception(s))",
        context["method"],
        context["path"],
        type(exc).__name__,
        len(exc.exceptions),
        extra={"request_context": context},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": GENERIC_SERVER_ERROR},
    )
