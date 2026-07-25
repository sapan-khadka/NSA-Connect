"""Sync Redis helpers for global presence and user notification fan-out."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import redis

from app.core.config import settings
from app.services.discussion_ws_manager import (
    PRESENCE_TTL_SECONDS,
    presence_redis_key,
)

logger = logging.getLogger(__name__)

GLOBAL_PRESENCE_TTL_SECONDS = 60
GLOBAL_PRESENCE_KEY_PREFIX = "presence:global:user:"


def global_presence_key(user_id: int) -> str:
    return f"{GLOBAL_PRESENCE_KEY_PREFIX}{user_id}"


def user_notify_channel(user_id: int) -> str:
    return f"notify:user:{user_id}"


_redis_client: redis.Redis | None = None
_redis_disabled = False


def get_discussion_sync_redis() -> redis.Redis | None:
    global _redis_client, _redis_disabled
    if _redis_disabled:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        _redis_client = client
        return client
    except Exception:
        logger.exception("Discussion sync Redis unavailable")
        _redis_disabled = True
        _redis_client = None
        return None


def reset_discussion_sync_redis(client: redis.Redis | None = None) -> None:
    """Test helper to swap or clear the sync Redis client."""
    global _redis_client, _redis_disabled
    _redis_client = client
    _redis_disabled = False


def touch_global_presence(user_id: int) -> None:
    client = get_discussion_sync_redis()
    if client is None:
        return
    try:
        client.setex(
            global_presence_key(user_id),
            GLOBAL_PRESENCE_TTL_SECONDS,
            "1",
        )
    except Exception:
        logger.debug("Failed to touch global presence for %s", user_id, exc_info=True)


def users_online(user_ids: list[int]) -> dict[int, bool]:
    ids = sorted({int(user_id) for user_id in user_ids if user_id})
    if not ids:
        return {}
    client = get_discussion_sync_redis()
    if client is None:
        return {user_id: False for user_id in ids}
    keys = [global_presence_key(user_id) for user_id in ids]
    try:
        values = client.mget(keys)
    except Exception:
        logger.debug("Failed to read global presence", exc_info=True)
        return {user_id: False for user_id in ids}
    return {
        user_id: bool(value)
        for user_id, value in zip(ids, values, strict=True)
    }


def user_present_in_room(room_key: str, user_id: int) -> bool:
    """Best-effort check against room presence hash (may miss local-only presence)."""
    client = get_discussion_sync_redis()
    if client is None:
        return False
    key = presence_redis_key(room_key)
    try:
        raw_map = client.hgetall(key)
    except Exception:
        logger.debug("Failed to read room presence for %s", room_key, exc_info=True)
        return False

    now = time.time()
    for raw in raw_map.values():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            continue
        expires_at = float(parsed.get("expires_at") or 0)
        if expires_at and expires_at < now:
            continue
        if int(parsed.get("user_id") or 0) == user_id:
            return True
    return False


def publish_user_notification(user_id: int, payload: dict[str, Any]) -> None:
    client = get_discussion_sync_redis()
    if client is None:
        return
    try:
        client.publish(user_notify_channel(user_id), json.dumps(payload))
    except Exception:
        logger.debug(
            "Failed to publish user notification for %s",
            user_id,
            exc_info=True,
        )


# Keep room presence TTL in sync with discussion_ws_manager for callers that
# want a matching offline timeout.
ROOM_PRESENCE_TTL_SECONDS = PRESENCE_TTL_SECONDS
