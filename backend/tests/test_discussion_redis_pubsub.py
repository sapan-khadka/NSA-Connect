"""Unit tests for Redis pub/sub fan-out and presence across ConnectionManager instances."""

from __future__ import annotations

import asyncio

import pytest

from app.services.discussion_ws_manager import (
    ConnectionManager,
    PresenceUser,
    redis_channel_for_room,
    room_key_from_redis_channel,
)


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)


@pytest.fixture
def fake_redis_server():
    try:
        import fakeredis
    except ImportError as exc:
        pytest.skip(f"fakeredis required: {exc}")

    return fakeredis.FakeServer()


def _user(user_id: int, name: str) -> PresenceUser:
    return PresenceUser(
        user_id=user_id,
        full_name=name,
        initials="".join(part[0] for part in name.split()[:2]).upper(),
    )


def test_redis_channel_helpers():
    assert redis_channel_for_room("board") == "discussion:board"
    assert redis_channel_for_room("event:12") == "discussion:event:12"
    assert room_key_from_redis_channel("discussion:board") == "board"
    assert room_key_from_redis_channel("discussion:event:12") == "event:12"
    assert room_key_from_redis_channel("other") is None


def test_publish_fans_out_across_manager_instances(fake_redis_server):
    import fakeredis.aioredis

    async def _run() -> None:
        redis_a = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )
        redis_b = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )

        manager_a = ConnectionManager(redis_client=redis_a)
        manager_b = ConnectionManager(redis_client=redis_b)
        socket_a = FakeWebSocket()
        socket_b = FakeWebSocket()

        try:
            await manager_a.connect(
                "event:7", socket_a, user=_user(1, "Alice Board")
            )
            await manager_b.connect(
                "event:7", socket_b, user=_user(2, "Bob Board")
            )
            await asyncio.sleep(0.05)

            payload = {
                "type": "message",
                "message": {
                    "id": 101,
                    "content": "cross-instance hello",
                    "event_id": 7,
                    "author": {"id": 1, "full_name": "Alice Board"},
                },
            }
            await manager_a.publish("event:7", payload)
            assert any(item == payload for item in socket_a.sent)

            for _ in range(50):
                if any(item == payload for item in socket_b.sent):
                    break
                await asyncio.sleep(0.05)

            assert any(item == payload for item in socket_b.sent)
        finally:
            await manager_a.aclose()
            await manager_b.aclose()

    asyncio.run(_run())


def test_publish_degrades_to_local_when_redis_disabled():
    async def _run() -> None:
        manager = ConnectionManager(redis_url="redis://127.0.0.1:1/0")
        manager._redis_disabled = True
        socket = FakeWebSocket()

        await manager.connect("board", socket, user=_user(9, "Solo User"))
        payload = {
            "type": "message",
            "message": {"id": 5, "content": "local only", "event_id": None},
        }
        await manager.publish("board", payload)
        assert payload in socket.sent
        await manager.aclose()

    asyncio.run(_run())


def test_presence_snapshot_and_ttl_expiry(fake_redis_server):
    import fakeredis.aioredis

    async def _run() -> None:
        redis = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )
        manager = ConnectionManager(redis_client=redis, presence_ttl_seconds=1)
        socket = FakeWebSocket()
        try:
            snapshot, first = await manager.connect(
                "board", socket, user=_user(3, "Cara Board")
            )
            assert first is True
            assert any(row["user_id"] == 3 for row in snapshot)

            await asyncio.sleep(1.2)
            expired = await manager.presence_snapshot("board")
            assert expired == []
        finally:
            await manager.aclose()

    asyncio.run(_run())


def test_typing_fans_out_without_persistence(fake_redis_server):
    import fakeredis.aioredis

    async def _run() -> None:
        redis_a = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )
        redis_b = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )
        manager_a = ConnectionManager(redis_client=redis_a)
        manager_b = ConnectionManager(redis_client=redis_b)
        socket_a = FakeWebSocket()
        socket_b = FakeWebSocket()
        try:
            await manager_a.connect(
                "board", socket_a, user=_user(1, "Alice Board")
            )
            await manager_b.connect(
                "board", socket_b, user=_user(2, "Bob Board")
            )
            await asyncio.sleep(0.05)

            typing_payload = {
                "type": "typing",
                "fanout_id": "typing-1",
                "is_typing": True,
                "user": _user(1, "Alice Board").to_dict(),
            }
            await manager_a.publish("board", typing_payload)

            for _ in range(50):
                if any(item.get("type") == "typing" for item in socket_b.sent):
                    break
                await asyncio.sleep(0.05)

            assert any(
                item.get("type") == "typing" and item.get("is_typing") is True
                for item in socket_b.sent
            )
        finally:
            await manager_a.aclose()
            await manager_b.aclose()

    asyncio.run(_run())


def test_presence_left_only_when_last_connection_closes(fake_redis_server):
    import fakeredis.aioredis

    async def _run() -> None:
        redis = fakeredis.aioredis.FakeRedis(
            server=fake_redis_server, decode_responses=True
        )
        manager = ConnectionManager(redis_client=redis)
        tab_a = FakeWebSocket()
        tab_b = FakeWebSocket()
        user = _user(4, "Dana Board")
        try:
            await manager.connect("event:1", tab_a, user=user)
            await manager.connect("event:1", tab_b, user=user)
            left_first = await manager.disconnect("event:1", tab_a)
            assert left_first is None
            snapshot = await manager.presence_snapshot("event:1")
            assert any(row["user_id"] == 4 for row in snapshot)

            left_second = await manager.disconnect("event:1", tab_b)
            assert left_second is not None
            assert left_second.user_id == 4
            assert await manager.presence_snapshot("event:1") == []
        finally:
            await manager.aclose()

    asyncio.run(_run())
