"""Accept a WebSocket only after a short-lived ticket arrives as the first message."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.core.config import cors_allow_origins, settings
from app.core.database import create_db_session
from app.core.security_events import log_security_event
from app.core.ws_auth import (
    TokenAuthenticationError,
    TokenAuthorizationError,
    authenticate_ws_ticket,
)
from app.models.member import Member

logger = logging.getLogger(__name__)

WS_CLOSE_UNAUTHORIZED = 4001
WS_CLOSE_FORBIDDEN = 4003
WS_CLOSE_LIMIT = 4029
_AUTH_MESSAGE_MAX_CHARS = 8192


class WebSocketAuthClosed(Exception):
    """The socket was rejected before any protected payload was sent."""


class _Gate:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._pending = 0
        self._total = 0
        self._per_user: dict[int, int] = {}

    async def acquire_pending(self) -> bool:
        async with self._lock:
            if self._pending >= settings.WS_MAX_PENDING_CONNECTIONS:
                return False
            if self._pending + self._total >= settings.WS_MAX_TOTAL_CONNECTIONS:
                return False
            self._pending += 1
            return True

    async def promote(self, user_id: int) -> bool:
        async with self._lock:
            if self._per_user.get(user_id, 0) >= settings.WS_MAX_CONNECTIONS_PER_USER:
                return False
            if self._total + 1 > settings.WS_MAX_TOTAL_CONNECTIONS:
                return False
            self._pending = max(0, self._pending - 1)
            self._per_user[user_id] = self._per_user.get(user_id, 0) + 1
            self._total += 1
            return True

    async def drop_pending(self) -> None:
        async with self._lock:
            self._pending = max(0, self._pending - 1)

    async def release_user(self, user_id: int) -> None:
        async with self._lock:
            current = self._per_user.get(user_id, 0)
            if current <= 1:
                self._per_user.pop(user_id, None)
            else:
                self._per_user[user_id] = current - 1
            self._total = max(0, self._total - 1)

    def reset(self) -> None:
        self._pending = 0
        self._total = 0
        self._per_user.clear()


connection_gate = _Gate()


def origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin or origin == "null":
        return False
    allowed = {item.rstrip("/") for item in cors_allow_origins()}
    return origin.rstrip("/") in allowed


def reset_ws_connection_gate() -> None:
    connection_gate.reset()


async def release_authenticated_socket(user_id: int) -> None:
    await connection_gate.release_user(user_id)


async def accept_authenticated_socket(websocket: WebSocket) -> Member:
    """Accept the socket, require a one-time ticket, and return the member.

    History, presence, and notifications are the caller's job and must run
    only after this returns.
    """
    if not origin_allowed(websocket):
        log_security_event("ws_origin_rejected")
        await _close(websocket, WS_CLOSE_FORBIDDEN)
        raise WebSocketAuthClosed

    if not await connection_gate.acquire_pending():
        log_security_event("ws_connection_limit")
        await _close(websocket, WS_CLOSE_LIMIT)
        raise WebSocketAuthClosed

    promoted = False
    try:
        await websocket.accept()
        ticket = await _read_ticket(websocket)
        if ticket is None:
            log_security_event("ws_auth_rejected", reason="missing_ticket")
            await _close(websocket, WS_CLOSE_UNAUTHORIZED)
            raise WebSocketAuthClosed

        db = create_db_session()
        try:
            try:
                member = authenticate_ws_ticket(db, ticket)
            except TokenAuthenticationError as exc:
                log_security_event(
                    "ws_auth_rejected",
                    reason="invalid_ticket",
                    detail=str(exc),
                )
                await _close(websocket, WS_CLOSE_UNAUTHORIZED)
                raise WebSocketAuthClosed
            except TokenAuthorizationError:
                log_security_event("ws_auth_rejected", reason="not_approved")
                await _close(websocket, WS_CLOSE_FORBIDDEN)
                raise WebSocketAuthClosed
        finally:
            db.close()

        if not await connection_gate.promote(member.id):
            log_security_event("ws_connection_limit", user_id=member.id)
            await _close(websocket, WS_CLOSE_LIMIT)
            raise WebSocketAuthClosed
        promoted = True
        return member
    finally:
        if not promoted:
            await connection_gate.drop_pending()


async def _read_ticket(websocket: WebSocket) -> str | None:
    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=settings.WS_AUTH_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        return None
    except WebSocketDisconnect as exc:
        raise WebSocketAuthClosed from exc
    return ticket_from_auth_message(raw)


def ticket_from_auth_message(raw: str) -> str | None:
    if not isinstance(raw, str) or len(raw) > _AUTH_MESSAGE_MAX_CHARS:
        return None
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(body, dict) or body.get("type") != "auth":
        return None
    ticket = body.get("ticket")
    if not isinstance(ticket, str):
        return None
    ticket = ticket.strip()
    if not ticket or len(ticket) > 4096:
        return None
    return ticket


async def _close(websocket: WebSocket, code: int) -> None:
    try:
        await websocket.close(code=code)
    except RuntimeError:
        logger.debug("WebSocket already closed during auth", exc_info=True)
