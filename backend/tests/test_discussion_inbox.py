"""Tests for discussion inbox (room list, unread, pins)."""

from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)


def _event_payload(**overrides):
    payload = {
        "name": "Inbox Fest",
        "starts_at": "2030-10-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Community celebration",
        "budget": "200.00",
    }
    payload.update(overrides)
    return payload


def test_discussion_inbox_lists_board_and_event_rooms_with_unread(
    client,
    db_session,
):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    event = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=headers,
    ).json()
    event_id = event["id"]

    board_msg = client.post(
        "/api/v1/board/discussion",
        json={"content": "Board hello"},
        headers=headers,
    )
    assert board_msg.status_code == 201

    event_msg = client.post(
        f"/api/v1/events/{event_id}/discussion",
        json={"content": "Event hello"},
        headers=headers,
    )
    assert event_msg.status_code == 201

    inbox = client.get("/api/v1/discussions/inbox", headers=headers)
    assert inbox.status_code == 200
    rooms = inbox.json()["rooms"]
    room_ids = {room["room_id"] for room in rooms}
    assert "board" in room_ids
    assert f"event:{event_id}" in room_ids

    board_room = next(room for room in rooms if room["room_id"] == "board")
    assert board_room["unread_count"] >= 1
    assert board_room["unread_display"] is not None
    assert board_room["pinned"] is True

    marked = client.post(
        "/api/v1/discussions/read",
        json={"room_id": "board"},
        headers=headers,
    )
    assert marked.status_code == 200
    assert marked.json()["room_id"] == "board"

    inbox_after = client.get("/api/v1/discussions/inbox", headers=headers)
    board_after = next(
        room for room in inbox_after.json()["rooms"] if room["room_id"] == "board"
    )
    assert board_after["unread_count"] == 0
    assert board_after["unread_display"] is None


def test_discussion_pin_toggle_orders_pinned_first(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    event = client.post(
        "/api/v1/events",
        json=_event_payload(name="Pinned Event"),
        headers=headers,
    ).json()
    event_id = event["id"]

    assert (
        client.post(
            "/api/v1/board/discussion",
            json={"content": "Board"},
            headers=headers,
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/api/v1/events/{event_id}/discussion",
            json={"content": "Event"},
            headers=headers,
        ).status_code
        == 201
    )

    pin = client.post(
        "/api/v1/discussions/pins/toggle",
        json={"room_id": f"event:{event_id}"},
        headers=headers,
    )
    assert pin.status_code == 200
    assert pin.json() == {"room_id": f"event:{event_id}", "pinned": True}

    rooms = client.get("/api/v1/discussions/inbox", headers=headers).json()["rooms"]
    assert rooms[0]["room_id"] == "board"
    assert rooms[0]["pinned"] is True
    assert rooms[1]["room_id"] == f"event:{event_id}"
    assert rooms[1]["pinned"] is True

    unpin = client.post(
        "/api/v1/discussions/pins/toggle",
        json={"room_id": f"event:{event_id}"},
        headers=headers,
    )
    assert unpin.json()["pinned"] is False


def test_discussion_inbox_hides_board_from_general_member(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    inbox = client.get("/api/v1/discussions/inbox", headers=headers)
    assert inbox.status_code == 200
    assert all(room["room_id"] != "board" for room in inbox.json()["rooms"])


def test_archive_board_and_event_discussion_hides_from_inbox(client, db_session):
    create_board_member(db_session)
    create_president_member(db_session)
    board_headers = auth_header(client, email="board@semo.edu")
    president_headers = auth_header(client, email="president@semo.edu")

    event = client.post(
        "/api/v1/events",
        json=_event_payload(name="Past Chat Fest"),
        headers=board_headers,
    ).json()
    event_id = event["id"]

    assert (
        client.post(
            "/api/v1/board/discussion",
            json={"content": "Board note"},
            headers=board_headers,
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/api/v1/events/{event_id}/discussion",
            json={"content": "Event note"},
            headers=board_headers,
        ).status_code
        == 201
    )

    forbidden = client.post(
        "/api/v1/discussions/archive",
        json={"room_id": f"event:{event_id}"},
        headers=board_headers,
    )
    assert forbidden.status_code == 403

    archived_event = client.post(
        "/api/v1/discussions/archive",
        json={"room_id": f"event:{event_id}"},
        headers=president_headers,
    )
    assert archived_event.status_code == 200
    assert archived_event.json()["archived"] is True

    archived_board = client.post(
        "/api/v1/discussions/archive",
        json={"room_id": "board"},
        headers=president_headers,
    )
    assert archived_board.status_code == 200

    inbox_after = client.get(
        "/api/v1/discussions/inbox",
        headers=president_headers,
    ).json()
    after_ids = {room["room_id"] for room in inbox_after["rooms"]}
    assert "board" not in after_ids
    assert f"event:{event_id}" not in after_ids
    archived_labels = {
        room["room_id"]: room["label"] for room in inbox_after["archived_rooms"]
    }
    assert archived_labels["board"] == "Board Discussion"
    assert archived_labels[f"event:{event_id}"] == "Past Chat Fest"

    blocked = client.post(
        f"/api/v1/events/{event_id}/discussion",
        json={"content": "Should fail"},
        headers=board_headers,
    )
    assert blocked.status_code == 422

    board_unarchive = client.post(
        "/api/v1/discussions/unarchive",
        json={"room_id": "board"},
        headers=board_headers,
    )
    assert board_unarchive.status_code == 403

    restored = client.post(
        "/api/v1/discussions/unarchive",
        json={"room_id": "board"},
        headers=president_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["archived"] is False
    inbox_restored = client.get(
        "/api/v1/discussions/inbox",
        headers=president_headers,
    ).json()
    assert any(room["room_id"] == "board" for room in inbox_restored["rooms"])
