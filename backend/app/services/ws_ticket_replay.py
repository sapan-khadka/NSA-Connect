"""Single-use WebSocket tickets.

Development keeps the used-id set in memory so the test suite does not need
Redis. Staging and production record the id in Redis and reject the ticket
when that write is unavailable.
"""

from __future__ import annotations

import logging
import threading
import time

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_used_until: dict[str, float] = {}
_redis_client = None
_redis_disabled = False


def consume_ws_ticket(jti: str, ttl_seconds: int) -> bool:
    """Return True only the first time ``jti`` is presented before it expires."""
    if not jti or ttl_seconds <= 0:
        return False
    if settings.ENVIRONMENT == "development":
        return _consume_memory(jti, ttl_seconds)

    client = _get_redis()
    if client is None:
        logger.error("WebSocket ticket replay store is unavailable")
        return False
    try:
        stored = client.set(
            f"ws:ticket:{jti}",
            "1",
            nx=True,
            ex=max(1, int(ttl_seconds)),
        )
    except Exception:
        logger.exception("WebSocket ticket replay store failed")
        return False
    return bool(stored)


def reset_ws_ticket_replay_store(client=None) -> None:
    """Test helper. Clears the memory set and optionally installs a Redis client."""
    global _redis_client, _redis_disabled
    with _lock:
        _used_until.clear()
    _redis_client = client
    _redis_disabled = False


def _consume_memory(jti: str, ttl_seconds: int) -> bool:
    now = time.monotonic()
    with _lock:
        expired = [key for key, until in _used_until.items() if until <= now]
        for key in expired:
            del _used_until[key]
        if jti in _used_until:
            return False
        _used_until[jti] = now + ttl_seconds
        return True


def _get_redis():
    global _redis_client, _redis_disabled
    if _redis_disabled:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis

        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
        )
        client.ping()
        _redis_client = client
        return client
    except Exception:
        logger.exception("WebSocket ticket replay Redis unavailable")
        _redis_disabled = True
        _redis_client = None
        return None
