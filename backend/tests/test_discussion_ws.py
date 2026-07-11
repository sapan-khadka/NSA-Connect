import json

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

from app.models.discussion_message import DiscussionMessage


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-10-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Community celebration",
        "budget": "200.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def board_access_token(client, board_member_headers):
    _ = board_member_headers
    return login_member(client, email="board@semo.edu").json()["access_token"]


def _create_event(client, headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _recv_until(ws, event_type: str, *, limit: int = 20):
    for _ in range(limit):
        payload = ws.receive_json()
        if payload.get("type") == event_type:
            return payload
    raise AssertionError(f"Did not receive WS event type={event_type!r}")


def test_ws_rejects_missing_token(client, board_member_headers):
    event = _create_event(client, board_member_headers)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/ws/events/{event['id']}/discussion"):
            pass
    assert exc_info.value.code == 4001


def test_ws_rejects_invalid_token(client, board_member_headers):
    event = _create_event(client, board_member_headers)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"/ws/events/{event['id']}/discussion?token=not-a-real-token"
        ):
            pass
    assert exc_info.value.code == 4001


def test_ws_sends_history_persists_and_broadcasts(
    client,
    db_session,
    board_member_headers,
    board_access_token,
):
    event = _create_event(client, board_member_headers)
    event_id = event["id"]

    seed = client.post(
        f"/api/v1/events/{event_id}/discussion",
        json={"content": "Seeded history message"},
        headers=board_member_headers,
    )
    assert seed.status_code == 201

    with client.websocket_connect(
        f"/ws/events/{event_id}/discussion?token={board_access_token}"
    ) as ws_a:
        history = _recv_until(ws_a, "history")
        assert len(history["messages"]) == 1
        assert history["messages"][0]["content"] == "Seeded history message"
        snapshot = _recv_until(ws_a, "presence_snapshot")
        assert any(user["user_id"] for user in snapshot["users"])

        with client.websocket_connect(
            f"/ws/events/{event_id}/discussion?token={board_access_token}"
        ) as ws_b:
            assert _recv_until(ws_b, "history")["type"] == "history"
            assert _recv_until(ws_b, "presence_snapshot")["type"] == "presence_snapshot"

            ws_a.send_text(json.dumps({"content": "Live hello from A"}))

            payload_a = _recv_until(ws_a, "message")
            payload_b = _recv_until(ws_b, "message")

            assert payload_a["message"]["content"] == "Live hello from A"
            assert payload_b["message"]["content"] == "Live hello from A"
            assert payload_a["message"]["id"] == payload_b["message"]["id"]
            assert payload_a["message"]["author"]["full_name"]

    saved = db_session.scalars(
        select(DiscussionMessage).where(
            DiscussionMessage.event_id == event_id,
            DiscussionMessage.content == "Live hello from A",
        )
    ).all()
    assert len(saved) == 1


def test_ws_history_survives_reconnect(
    client,
    board_member_headers,
    board_access_token,
):
    event = _create_event(client, board_member_headers)
    event_id = event["id"]

    with client.websocket_connect(
        f"/ws/events/{event_id}/discussion?token={board_access_token}"
    ) as ws:
        assert _recv_until(ws, "history")["type"] == "history"
        ws.send_text(json.dumps({"content": "Persisted over WS"}))
        created = _recv_until(ws, "message")
        message_id = created["message"]["id"]

    with client.websocket_connect(
        f"/ws/events/{event_id}/discussion?token={board_access_token}"
    ) as ws:
        history = _recv_until(ws, "history")
        assert any(message["id"] == message_id for message in history["messages"])
        assert any(
            message["content"] == "Persisted over WS"
            for message in history["messages"]
        )


def test_ws_forbids_non_volunteer_general_member(
    client,
    db_session,
    board_member_headers,
):
    event = _create_event(client, board_member_headers)
    register_member(client)
    set_member_approved(db_session)
    token = login_member(client).json()["access_token"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"/ws/events/{event['id']}/discussion?token={token}"
        ):
            pass
    assert exc_info.value.code == 4003


def test_board_ws_rejects_missing_token(client, board_member_headers):
    _ = board_member_headers
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/board/discussion"):
            pass
    assert exc_info.value.code == 4001


def test_board_ws_forbids_general_member(client, db_session, board_member_headers):
    _ = board_member_headers
    register_member(client)
    set_member_approved(db_session)
    token = login_member(client).json()["access_token"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/ws/board/discussion?token={token}"):
            pass
    assert exc_info.value.code == 4003


def test_board_ws_persists_and_broadcasts(
    client,
    db_session,
    board_member_headers,
    board_access_token,
):
    seed = client.post(
        "/api/v1/board/discussion",
        json={"content": "Board seed"},
        headers=board_member_headers,
    )
    assert seed.status_code == 201

    with client.websocket_connect(
        f"/ws/board/discussion?token={board_access_token}"
    ) as ws_a:
        history = _recv_until(ws_a, "history")
        assert any(message["content"] == "Board seed" for message in history["messages"])
        assert _recv_until(ws_a, "presence_snapshot")["type"] == "presence_snapshot"

        with client.websocket_connect(
            f"/ws/board/discussion?token={board_access_token}"
        ) as ws_b:
            assert _recv_until(ws_b, "history")["type"] == "history"
            assert _recv_until(ws_b, "presence_snapshot")["type"] == "presence_snapshot"

            ws_a.send_text(json.dumps({"content": "Board live hello"}))
            payload_a = _recv_until(ws_a, "message")
            payload_b = _recv_until(ws_b, "message")

            assert payload_a["message"]["content"] == "Board live hello"
            assert payload_b["message"]["content"] == "Board live hello"
            assert payload_a["message"]["id"] == payload_b["message"]["id"]
            assert payload_a["message"]["event_id"] is None

    saved = db_session.scalars(
        select(DiscussionMessage).where(
            DiscussionMessage.event_id.is_(None),
            DiscussionMessage.content == "Board live hello",
        )
    ).all()
    assert len(saved) == 1
