"""WebSocket tickets are single-use, short-lived, and never travel in the URL."""

import asyncio
import logging

import pytest
from conftest import (
    auth_header,
    create_board_member,
    login_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.core.config import settings
from app.core.security import create_ws_ticket
from app.core.ws_handshake import reset_ws_connection_gate
from app.models.member import Member
from app.models.organization import Organization, OrganizationStatus
from app.models.organization_membership import OrganizationMembership
from app.services.organization_context import get_default_organization_id
from app.services.user_notify_ws_manager import UserNotifyConnectionManager
from app.services.ws_ticket_replay import reset_ws_ticket_replay_store

_ORIGIN = {"origin": "http://localhost:5173"}


class _Sink:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.messages.append(payload)


@pytest.fixture(autouse=True)
def _reset_socket_state():
    reset_ws_connection_gate()
    reset_ws_ticket_replay_store()
    yield
    reset_ws_connection_gate()
    reset_ws_ticket_replay_store()


def _board(client, db_session):
    create_board_member(
        db_session,
        email="board-ws@semo.edu",
        student_id="32323232",
    )
    return auth_header(client, email="board-ws@semo.edu")


def _event(client, headers) -> int:
    response = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "name": "Handshake Social",
            "starts_at": "2030-10-01T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Live chat",
            "budget": "10.00",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _issue(client, headers) -> str:
    response = client.post("/api/v1/discussions/ws-ticket", headers=headers)
    assert response.status_code == 200
    return response.json()["token"]


def test_notification_socket_sends_nothing_until_the_ticket_arrives(
    client, db_session
):
    headers = _board(client, db_session)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
            websocket.send_json({"type": "presence_heartbeat"})
            websocket.receive_json()
    assert exc_info.value.code == 4001

    with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
        websocket.send_json({"type": "auth", "ticket": _issue(client, headers)})
        assert websocket.receive_json() == {"type": "ready"}


def test_query_string_token_does_not_authenticate_or_consume_the_ticket(
    client, db_session, caplog
):
    headers = _board(client, db_session)
    event_id = _event(client, headers)
    ticket = _issue(client, headers)
    caplog.set_level(logging.INFO)

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"/ws/events/{event_id}/discussion?token={ticket}",
            headers=_ORIGIN,
        ) as websocket:
            websocket.send_json({"type": "presence_heartbeat"})
            websocket.receive_json()
    assert exc_info.value.code == 4001
    assert (ticket in caplog.text) is False

    with client.websocket_connect(
        f"/ws/events/{event_id}/discussion",
        headers=_ORIGIN,
    ) as websocket:
        websocket.send_json({"type": "auth", "ticket": ticket})
        assert websocket.receive_json()["type"] == "history"


def test_access_token_and_expired_ticket_are_rejected(client, db_session):
    _board(client, db_session)
    login = login_member(client, email="board-ws@semo.edu")
    assert login.status_code == 200
    access_token = login.json()["access_token"]
    member = db_session.scalar(select(Member).where(Member.email == "board-ws@semo.edu"))
    expired, _expires = create_ws_ticket(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
        expires_seconds=-5,
    )

    for credential in (access_token, expired):
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/ws/notifications",
                headers=_ORIGIN,
            ) as websocket:
                websocket.send_json({"type": "auth", "ticket": credential})
                websocket.receive_json()
        assert exc_info.value.code == 4001


def test_ticket_cannot_be_replayed_and_a_new_ticket_reconnects(client, db_session):
    headers = _board(client, db_session)
    first = _issue(client, headers)
    with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
        websocket.send_json({"type": "auth", "ticket": first})
        assert websocket.receive_json()["type"] == "ready"

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
            websocket.send_json({"type": "auth", "ticket": first})
            websocket.receive_json()
    assert exc_info.value.code == 4001

    with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
        websocket.send_json({"type": "auth", "ticket": _issue(client, headers)})
        assert websocket.receive_json()["type"] == "ready"


def test_auth_times_out_without_a_protected_payload(client, db_session, monkeypatch):
    _board(client, db_session)
    monkeypatch.setattr(settings, "WS_AUTH_TIMEOUT_SECONDS", 0.2)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/notifications", headers=_ORIGIN) as websocket:
            websocket.receive_json()
    assert exc_info.value.code == 4001


def test_origin_and_connection_limits_reject_before_room_data(
    client, db_session, monkeypatch
):
    headers = _board(client, db_session)
    event_id = _event(client, headers)

    with pytest.raises(WebSocketDisconnect) as missing_origin:
        with client.websocket_connect(f"/ws/events/{event_id}/discussion") as websocket:
            websocket.receive_json()
    assert missing_origin.value.code == 4003

    with pytest.raises(WebSocketDisconnect) as foreign_origin:
        with client.websocket_connect(
            f"/ws/events/{event_id}/discussion",
            headers={"origin": "https://evil.example"},
        ) as websocket:
            websocket.receive_json()
    assert foreign_origin.value.code == 4003

    monkeypatch.setattr(settings, "WS_MAX_CONNECTIONS_PER_USER", 1)
    with client.websocket_connect(
        f"/ws/events/{event_id}/discussion",
        headers=_ORIGIN,
    ) as first:
        first.send_json({"type": "auth", "ticket": _issue(client, headers)})
        assert first.receive_json()["type"] == "history"
        with pytest.raises(WebSocketDisconnect) as limited:
            with client.websocket_connect(
                "/ws/notifications",
                headers=_ORIGIN,
            ) as second:
                second.send_json({"type": "auth", "ticket": _issue(client, headers)})
                second.receive_json()
        assert limited.value.code == 4029


def test_other_organization_cannot_read_discussion_history(client, db_session):
    headers = _board(client, db_session)
    event_id = _event(client, headers)
    register_member(client, email="outsider-ws@semo.edu", student_id="42424242")
    set_member_approved(db_session, email="outsider-ws@semo.edu")
    outsider = db_session.scalar(
        select(Member).where(Member.email == "outsider-ws@semo.edu")
    )
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter-ws",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    membership = db_session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == outsider.id
        )
    )
    membership.organization_id = other.id
    db_session.commit()
    outsider_headers = auth_header(client, email="outsider-ws@semo.edu")

    seen: list[dict] = []
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"/ws/events/{event_id}/discussion",
            headers=_ORIGIN,
        ) as websocket:
            websocket.send_json(
                {"type": "auth", "ticket": _issue(client, outsider_headers)}
            )
            seen.append(websocket.receive_json())
    assert exc_info.value.code == 4003
    assert seen == []


def test_notification_delivery_stays_on_the_recipient_socket():
    manager = UserNotifyConnectionManager()
    insider = _Sink()
    outsider = _Sink()

    async def deliver() -> None:
        await manager.connect(41, insider)
        await manager.connect(42, outsider)
        await manager._local_broadcast(
            41,
            {"type": "inbox_notification", "title": "Chapter only"},
        )

    asyncio.run(deliver())
    assert insider.messages == [{"type": "inbox_notification", "title": "Chapter only"}]
    assert outsider.messages == []

