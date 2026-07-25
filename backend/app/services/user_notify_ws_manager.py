"""Per-user WebSocket fan-out for chat/inbox toast notifications."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.services.discussion_realtime_sync import user_notify_channel

logger = logging.getLogger(__name__)


class UserNotifyConnectionManager:
    def __init__(
        self,
        *,
        redis_url: str | None = None,
        redis_client: Any | None = None,
    ) -> None:
        self.active_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._redis_url = redis_url
        self._redis_client = redis_client
        self._owns_redis_client = redis_client is None
        self._pubsub: Any | None = None
        self._listener_task: asyncio.Task | None = None
        self._subscribed_channels: set[str] = set()
        self._lock = asyncio.Lock()
        self._redis_disabled = False
        self._locally_published_keys: set[str] = set()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        self.active_connections[user_id].add(websocket)
        await self._ensure_subscribed(user_id)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self.active_connections.get(user_id)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                self.active_connections.pop(user_id, None)
                await self._unsubscribe(user_id)

    async def publish(self, user_id: int, message: dict[str, Any]) -> None:
        echo_key = _echo_key(message)
        if echo_key is not None:
            self._locally_published_keys.add(echo_key)

        client = await self._get_redis()
        if client is not None:
            channel = user_notify_channel(user_id)
            try:
                await client.publish(channel, json.dumps(message))
            except Exception:
                logger.exception(
                    "User notify Redis publish failed for %s; local only",
                    channel,
                )

        await self._local_broadcast(user_id, message)

    async def _local_broadcast(self, user_id: int, message: dict[str, Any]) -> None:
        sockets = list(self.active_connections.get(user_id, set()))
        dead: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(message)
            except Exception:
                logger.debug(
                    "Failed to send user notify WS for %s; pruning",
                    user_id,
                    exc_info=True,
                )
                dead.append(websocket)
        for websocket in dead:
            await self.disconnect(user_id, websocket)

    async def _get_redis(self) -> Any | None:
        if self._redis_disabled:
            return None
        if self._redis_client is not None:
            return self._redis_client
        try:
            import redis.asyncio as redis_async

            from app.core.config import settings

            url = self._redis_url or settings.REDIS_URL
            client = redis_async.from_url(url, decode_responses=True)
            await client.ping()
            self._redis_client = client
            self._owns_redis_client = True
            return client
        except Exception:
            logger.exception("User notify Redis unavailable; local-only")
            self._redis_disabled = True
            self._redis_client = None
            return None

    async def _ensure_subscribed(self, user_id: int) -> None:
        channel = user_notify_channel(user_id)
        async with self._lock:
            if channel in self._subscribed_channels:
                return
            client = await self._get_redis()
            if client is None:
                return
            try:
                if self._pubsub is None:
                    self._pubsub = client.pubsub()
                await self._pubsub.subscribe(channel)
                self._subscribed_channels.add(channel)
                if self._listener_task is None or self._listener_task.done():
                    self._listener_task = asyncio.create_task(
                        self._listen_loop(),
                        name="user-notify-redis-pubsub",
                    )
            except Exception:
                logger.exception(
                    "User notify Redis subscribe failed for %s",
                    channel,
                )

    async def _unsubscribe(self, user_id: int) -> None:
        channel = user_notify_channel(user_id)
        async with self._lock:
            if channel not in self._subscribed_channels:
                return
            self._subscribed_channels.discard(channel)
            if self._pubsub is None:
                return
            try:
                await self._pubsub.unsubscribe(channel)
            except Exception:
                logger.debug(
                    "User notify Redis unsubscribe failed for %s",
                    channel,
                    exc_info=True,
                )
            if not self._subscribed_channels:
                await self._stop_listener_locked()

    async def _listen_loop(self) -> None:
        pubsub = self._pubsub
        if pubsub is None:
            return
        try:
            while True:
                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("User notify Redis listener error")
                    await asyncio.sleep(1.0)
                    continue

                if message is None:
                    await asyncio.sleep(0.01)
                    continue
                if message.get("type") != "message":
                    continue

                channel = message.get("channel")
                raw = message.get("data")
                if not isinstance(channel, str) or not isinstance(raw, str):
                    continue
                if not channel.startswith("notify:user:"):
                    continue
                try:
                    user_id = int(channel.removeprefix("notify:user:"))
                except ValueError:
                    continue

                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(payload, dict):
                    continue

                echo_key = _echo_key(payload)
                if echo_key is not None and echo_key in self._locally_published_keys:
                    self._locally_published_keys.discard(echo_key)
                    continue

                await self._local_broadcast(user_id, payload)
        except asyncio.CancelledError:
            raise

    async def _stop_listener_locked(self) -> None:
        task = self._listener_task
        self._listener_task = None
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        if self._pubsub is not None:
            try:
                await self._pubsub.aclose()
            except Exception:
                logger.debug("User notify pubsub close failed", exc_info=True)
            self._pubsub = None

    async def aclose(self) -> None:
        async with self._lock:
            self._subscribed_channels.clear()
            self._locally_published_keys.clear()
            self.active_connections.clear()
            await self._stop_listener_locked()
            if self._owns_redis_client and self._redis_client is not None:
                try:
                    await self._redis_client.aclose()
                except Exception:
                    logger.debug("User notify Redis close failed", exc_info=True)
            self._redis_client = None
            self._redis_disabled = False


def _echo_key(payload: dict[str, Any]) -> str | None:
    notification_id = payload.get("notification_id")
    if isinstance(notification_id, int):
        return f"n:{notification_id}"
    message_id = payload.get("message_id")
    user_hint = payload.get("href")
    if isinstance(message_id, int) and isinstance(user_hint, str):
        return f"m:{message_id}:{user_hint}"
    return None


user_notify_connection_manager = UserNotifyConnectionManager()
