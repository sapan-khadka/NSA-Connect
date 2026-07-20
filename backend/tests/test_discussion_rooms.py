"""Custom discussion room create / approve / messaging."""

from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    create_vice_president_member,
    register_member,
    set_member_approved,
)


def test_board_member_creates_pending_room(client, db_session):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    response = client.post(
        "/api/v1/discussions/rooms",
        headers=headers,
        json={"name": "Fundraising Committee", "description": "Sponsor outreach"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Fundraising Committee"
    assert body["status"] == "pending"
    assert body["room_id"].startswith("room:")
    assert any(member["role"] == "owner" for member in body["members"])


def test_president_auto_lives_room(client, db_session):
    create_president_member(db_session)
    headers = auth_header(client, email="president@semo.edu")

    response = client.post(
        "/api/v1/discussions/rooms",
        headers=headers,
        json={"name": "Exec Sync"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "live"


def test_vp_approves_pending_room(client, db_session):
    create_board_member(db_session)
    create_vice_president_member(db_session)
    board_headers = auth_header(client, email="board@semo.edu")
    vp_headers = auth_header(client, email="vp@semo.edu")

    created = client.post(
        "/api/v1/discussions/rooms",
        headers=board_headers,
        json={"name": "Decor Crew"},
    ).json()
    room_id = created["id"]

    pending = client.get(
        "/api/v1/discussions/rooms/pending",
        headers=vp_headers,
    )
    assert pending.status_code == 200
    assert any(room["id"] == room_id for room in pending.json()["rooms"])

    approved = client.post(
        f"/api/v1/discussions/rooms/{room_id}/approve",
        headers=vp_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "live"


def test_cannot_message_pending_room(client, db_session):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    created = client.post(
        "/api/v1/discussions/rooms",
        headers=headers,
        json={"name": "Quiet Planning"},
    ).json()
    room_id = created["id"]

    response = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=headers,
        json={"content": "Hello"},
    )
    assert response.status_code == 403


def test_live_room_messaging_and_inbox(client, db_session):
    create_board_member(db_session)
    create_president_member(db_session)
    board_headers = auth_header(client, email="board@semo.edu")
    president_headers = auth_header(client, email="president@semo.edu")

    created = client.post(
        "/api/v1/discussions/rooms",
        headers=board_headers,
        json={"name": "Logistics"},
    ).json()
    room_id = created["id"]

    client.post(
        f"/api/v1/discussions/rooms/{room_id}/approve",
        headers=president_headers,
    )

    posted = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=board_headers,
        json={"content": "Need tables by Friday"},
    )
    assert posted.status_code == 201
    assert posted.json()["custom_room_id"] == room_id
    assert posted.json()["event_id"] is None

    inbox = client.get("/api/v1/discussions/inbox", headers=board_headers)
    assert inbox.status_code == 200
    rooms = inbox.json()["rooms"]
    match = next(room for room in rooms if room["room_id"] == f"room:{room_id}")
    assert match["label"] == "Logistics"
    assert "tables" in (match["last_message_preview"] or "")


def test_general_member_cannot_create_room(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/discussions/rooms",
        headers=headers,
        json={"name": "Should fail"},
    )
    assert response.status_code == 403


def test_archive_live_room(client, db_session):
    create_president_member(db_session)
    headers = auth_header(client, email="president@semo.edu")

    created = client.post(
        "/api/v1/discussions/rooms",
        headers=headers,
        json={"name": "Temp Group"},
    ).json()
    room_id = created["id"]
    assert created["status"] == "live"

    archived = client.post(
        f"/api/v1/discussions/rooms/{room_id}/archive",
        headers=headers,
    )
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
