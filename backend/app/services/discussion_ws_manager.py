"""Local WebSockets + Redis pub/sub fan-out, presence, and typing for discussions."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

BOARD_ROOM_KEY = "board"

# Safety net when a client drops without a clean disconnect.
PRESENCE_TTL_SECONDS = 45
PRESENCE_KEY_TTL_SECONDS = 90


def event_room_key(event_id: int) -> str:
    return f"event:{event_id}"


def custom_room_key(room_id: int) -> str:
    return f"room:{room_id}"


def redis_channel_for_room(room_key: str) -> str:
    """Map internal room keys to Redis channels.

    ``event:12`` → ``discussion:event:12``
    ``board`` → ``discussion:board``
    """
    return f"discussion:{room_key}"


def presence_redis_key(room_key: str) -> str:
    return f"presence:{room_key}:conns"


def room_key_from_redis_channel(channel: str) -> str | None:
    prefix = "discussion:"
    if not channel.startswith(prefix):
        return None
    return channel[len(prefix) :]


def initials_from_name(full_name: str) -> str:
    parts = [part for part in full_name.split() if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


@dataclass(frozen=True, slots=True)
class PresenceUser:
    user_id: int
    full_name: str
    initials: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_member(cls, member: Any) -> PresenceUser:
        full_name = str(getattr(member, "full_name", "") or "").strip() or "Member"
        return cls(
            user_id=int(member.id),
            full_name=full_name,
            initials=initials_from_name(full_name),
        )


@dataclass(slots=True)
class _ConnectionMeta:
    room_key: str
    conn_id: str
    user: PresenceUser


class ConnectionManager:
    def __init__(
        self,
        *,
        redis_url: str | None = None,
        redis_client: Any | None = None,
        presence_ttl_seconds: int = PRESENCE_TTL_SECONDS,
    ) -> None:
        self.active_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._connection_meta: dict[WebSocket, _ConnectionMeta] = {}
        self._local_presence: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        self._redis_url = redis_url
        self._redis_client = redis_client
        self._owns_redis_client = redis_client is None
        self._pubsub: Any | None = None
        self._listener_task: asyncio.Task | None = None
        self._subscribed_channels: set[str] = set()
        self._lock = asyncio.Lock()
        self._redis_disabled = False
        self._locally_published_keys: set[str] = set()
        self._presence_ttl_seconds = presence_ttl_seconds

    async def connect(
        self,
        room_key: str,
        websocket: WebSocket,
        *,
        user: PresenceUser,
    ) -> tuple[list[dict[str, Any]], bool]:
        """Register a socket and return (presence_snapshot, is_first_conn_for_user)."""
        conn_id = str(uuid.uuid4())
        self.active_connections[room_key].add(websocket)
        self._connection_meta[websocket] = _ConnectionMeta(
            room_key=room_key,
            conn_id=conn_id,
            user=user,
        )
        await self._ensure_subscribed(room_key)

        was_present = await self._user_is_present(room_key, user.user_id)
        await self._presence_upsert(room_key, conn_id, user)
        snapshot = await self.presence_snapshot(room_key)
        return snapshot, not was_present

    async def disconnect(
        self,
        room_key: str,
        websocket: WebSocket,
    ) -> PresenceUser | None:
        """Remove a socket. Returns the user if they fully left the room."""
        meta = self._connection_meta.pop(websocket, None)
        sockets = self.active_connections.get(room_key)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                self.active_connections.pop(room_key, None)
                await self._unsubscribe(room_key)

        if meta is None:
            return None

        await self._presence_remove(room_key, meta.conn_id)
        still_present = await self._user_is_present(room_key, meta.user.user_id)
        if still_present:
            return None
        return meta.user

    async def refresh_presence(self, websocket: WebSocket) -> None:
        meta = self._connection_meta.get(websocket)
        if meta is None:
            return
        await self._presence_upsert(meta.room_key, meta.conn_id, meta.user)

    async def presence_snapshot(self, room_key: str) -> list[dict[str, Any]]:
        entries = await self._presence_entries(room_key)
        users: dict[int, dict[str, Any]] = {}
        now = time.time()
        for entry in entries:
            expires_at = float(entry.get("expires_at") or 0)
            if expires_at and expires_at < now:
                continue
            user_id = entry.get("user_id")
            if not isinstance(user_id, int):
                continue
            users[user_id] = {
                "user_id": user_id,
                "full_name": entry.get("full_name") or "Member",
                "initials": entry.get("initials")
                or initials_from_name(str(entry.get("full_name") or "Member")),
            }
        return sorted(users.values(), key=lambda row: str(row["full_name"]).lower())

    async def publish(self, room_key: str, message: dict) -> None:
        """Fan-out via Redis and deliver immediately to local sockets."""
        echo_key = _echo_key(message)
        if echo_key is not None:
            self._locally_published_keys.add(echo_key)

        client = await self._get_redis()
        if client is not None:
            channel = redis_channel_for_room(room_key)
            try:
                await client.publish(channel, json.dumps(message))
            except Exception:
                logger.exception(
                    "Discussion Redis publish failed for %s; local broadcast only",
                    channel,
                )

        await self._local_broadcast(room_key, message)

    async def broadcast(self, room_key: str, message: dict) -> None:
        await self.publish(room_key, message)

    async def _local_broadcast(self, room_key: str, message: dict) -> None:
        sockets = list(self.active_connections.get(room_key, set()))
        dead: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(message)
            except Exception:
                logger.debug(
                    "Failed to send discussion WS message for room %s; pruning",
                    room_key,
                    exc_info=True,
                )
                dead.append(websocket)

        for websocket in dead:
            await self.disconnect(room_key, websocket)

    async def _presence_upsert(
        self,
        room_key: str,
        conn_id: str,
        user: PresenceUser,
    ) -> None:
        payload = {
            **user.to_dict(),
            "conn_id": conn_id,
            "expires_at": time.time() + self._presence_ttl_seconds,
        }
        client = await self._get_redis()
        if client is None:
            self._local_presence[room_key][conn_id] = payload
            return

        key = presence_redis_key(room_key)
        try:
            await client.hset(key, conn_id, json.dumps(payload))
            await client.expire(key, PRESENCE_KEY_TTL_SECONDS)
        except Exception:
            logger.exception(
                "Discussion presence upsert failed for %s; using local presence",
                key,
            )
            self._local_presence[room_key][conn_id] = payload

    async def _presence_remove(self, room_key: str, conn_id: str) -> None:
        self._local_presence.get(room_key, {}).pop(conn_id, None)
        if room_key in self._local_presence and not self._local_presence[room_key]:
            self._local_presence.pop(room_key, None)

        client = await self._get_redis()
        if client is None:
            return
        key = presence_redis_key(room_key)
        try:
            await client.hdel(key, conn_id)
        except Exception:
            logger.debug(
                "Discussion presence remove failed for %s/%s",
                key,
                conn_id,
                exc_info=True,
            )

    async def _presence_entries(self, room_key: str) -> list[dict[str, Any]]:
        client = await self._get_redis()
        entries: list[dict[str, Any]] = []

        if client is not None:
            key = presence_redis_key(room_key)
            try:
                raw_map = await client.hgetall(key)
                stale_fields: list[str] = []
                now = time.time()
                for field, raw in raw_map.items():
                    try:
                        parsed = json.loads(raw)
                    except json.JSONDecodeError:
                        stale_fields.append(field)
                        continue
                    if not isinstance(parsed, dict):
                        stale_fields.append(field)
                        continue
                    expires_at = float(parsed.get("expires_at") or 0)
                    if expires_at and expires_at < now:
                        stale_fields.append(field)
                        continue
                    entries.append(parsed)
                if stale_fields:
                    await client.hdel(key, *stale_fields)
            except Exception:
                logger.exception(
                    "Discussion presence read failed for %s; falling back to local",
                    key,
                )

        now = time.time()
        local = self._local_presence.get(room_key, {})
        for conn_id, parsed in list(local.items()):
            expires_at = float(parsed.get("expires_at") or 0)
            if expires_at and expires_at < now:
                local.pop(conn_id, None)
                continue
            entries.append(parsed)
        return entries

    async def _user_is_present(self, room_key: str, user_id: int) -> bool:
        entries = await self._presence_entries(room_key)
        return any(entry.get("user_id") == user_id for entry in entries)

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
            logger.info("Discussion Redis pub/sub connected (%s)", url.split("@")[-1])
            return client
        except Exception:
            logger.exception(
                "Discussion Redis unavailable; degrading to local-only broadcast"
            )
            self._redis_disabled = True
            self._redis_client = None
            return None

    async def _ensure_subscribed(self, room_key: str) -> None:
        channel = redis_channel_for_room(room_key)
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
                        name="discussion-redis-pubsub",
                    )
            except Exception:
                logger.exception(
                    "Discussion Redis subscribe failed for %s; local-only for this room",
                    channel,
                )

    async def _unsubscribe(self, room_key: str) -> None:
        channel = redis_channel_for_room(room_key)
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
                    "Discussion Redis unsubscribe failed for %s",
                    channel,
                    exc_info=True,
                )

            if self._subscribed_channels:
                return

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
                    logger.exception(
                        "Discussion Redis listener error; pausing before retry"
                    )
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

                room_key = room_key_from_redis_channel(channel)
                if room_key is None:
                    continue

                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning(
                        "Ignoring non-JSON discussion Redis payload on %s", channel
                    )
                    continue

                if not isinstance(payload, dict):
                    continue

                echo_key = _echo_key(payload)
                if echo_key is not None and echo_key in self._locally_published_keys:
                    self._locally_published_keys.discard(echo_key)
                    continue

                await self._local_broadcast(room_key, payload)
        except asyncio.CancelledError:
            logger.debug("Discussion Redis listener cancelled")
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
                logger.debug("Discussion Redis pubsub close failed", exc_info=True)
            self._pubsub = None

    async def aclose(self) -> None:
        """Shut down listener and Redis clients (app lifespan)."""
        async with self._lock:
            self._subscribed_channels.clear()
            self._locally_published_keys.clear()
            self._local_presence.clear()
            self._connection_meta.clear()
            self.active_connections.clear()
            await self._stop_listener_locked()
            if self._owns_redis_client and self._redis_client is not None:
                try:
                    await self._redis_client.aclose()
                except Exception:
                    logger.debug("Discussion Redis client close failed", exc_info=True)
            self._redis_client = None
            self._redis_disabled = False


def _message_id(payload: dict) -> int | None:
    message = payload.get("message")
    if not isinstance(message, dict):
        return None
    raw_id = message.get("id")
    return raw_id if isinstance(raw_id, int) else None


def _echo_key(payload: dict) -> str | None:
    fanout_id = payload.get("fanout_id")
    if isinstance(fanout_id, str) and fanout_id:
        return f"f:{fanout_id}"
    message_id = _message_id(payload)
    if message_id is not None:
        return f"m:{message_id}"
    return None


def new_fanout_id() -> str:
    return str(uuid.uuid4())


discussion_connection_manager = ConnectionManager()
