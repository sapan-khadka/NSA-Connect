"""Personal notepad — private notes for board members."""

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)

from app.models.event import Event
from tests.test_create_event import _event_payload


@pytest.fixture
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def president_headers(client, db_session):
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def general_headers(client, db_session):
    register_member(client, email="general@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="general@semo.edu")
    return auth_header(client, email="general@semo.edu")


@pytest.fixture
def sample_event(db_session, board_headers, client):
    response = client.post(
        "/api/v1/events",
        headers=board_headers,
        json=_event_payload(name="Dashain Social", starts_at="2030-10-15T18:00:00+00:00"),
    )
    assert response.status_code == 201
    event_id = response.json()["id"]
    return db_session.get(Event, event_id)


def test_board_member_can_crud_personal_notes(client, board_headers, sample_event):
    empty = client.get("/api/v1/me/notepad", headers=board_headers)
    assert empty.status_code == 200
    assert empty.json()["notes"] == []

    created = client.post(
        "/api/v1/me/notepad",
        headers=board_headers,
        json={
            "title": "Follow up",
            "content": "Confirm venue deposit for Dashain Social.",
            "event_id": sample_event.id,
            "pinned": True,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Follow up"
    assert body["content"] == "Confirm venue deposit for Dashain Social."
    assert body["event_id"] == sample_event.id
    assert body["event_name"] == "Dashain Social"
    assert body["pinned"] is True

    filtered = client.get(
        f"/api/v1/me/notepad?event_id={sample_event.id}",
        headers=board_headers,
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1

    updated = client.patch(
        f"/api/v1/me/notepad/{body['id']}",
        headers=board_headers,
        json={"content": "Deposit paid.", "pinned": False, "clear_event": True},
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "Deposit paid."
    assert updated.json()["event_id"] is None

    deleted = client.delete(
        f"/api/v1/me/notepad/{body['id']}",
        headers=board_headers,
    )
    assert deleted.status_code == 204


def test_general_member_cannot_use_notepad(client, general_headers):
    response = client.get("/api/v1/me/notepad", headers=general_headers)
    assert response.status_code == 403

    created = client.post(
        "/api/v1/me/notepad",
        headers=general_headers,
        json={"content": "Should fail"},
    )
    assert created.status_code == 403


def test_notes_are_private_per_member(
    client,
    board_headers,
    president_headers,
):
    created = client.post(
        "/api/v1/me/notepad",
        headers=board_headers,
        json={"content": "Board-only reminder"},
    )
    assert created.status_code == 201
    note_id = created.json()["id"]

    president_list = client.get("/api/v1/me/notepad", headers=president_headers)
    assert president_list.status_code == 200
    assert president_list.json()["notes"] == []

    president_update = client.patch(
        f"/api/v1/me/notepad/{note_id}",
        headers=president_headers,
        json={"content": "Hijacked"},
    )
    assert president_update.status_code == 404


def test_create_with_unknown_event_returns_404(client, board_headers):
    response = client.post(
        "/api/v1/me/notepad",
        headers=board_headers,
        json={"content": "Note", "event_id": 999999},
    )
    assert response.status_code == 404
