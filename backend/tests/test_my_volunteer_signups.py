from datetime import UTC, datetime

import pytest

from app.models.event import Event
from conftest import auth_header, create_board_member, register_member, set_member_approved


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night with food and performances.",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


def _slot_payload(**overrides):
    payload = {
        "task_name": "Setup crew",
        "max_signup_count": 4,
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def _create_slot(client, board_member_headers, **event_overrides):
    event_response = client.post(
        "/api/v1/events",
        json=_event_payload(**event_overrides),
        headers=board_member_headers,
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    slot_response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(),
        headers=board_member_headers,
    )
    assert slot_response.status_code == 201
    return slot_response.json()


def test_member_lists_their_volunteer_signups(
    client,
    board_member_headers,
    general_member_headers,
):
    slot = _create_slot(client, board_member_headers)

    signup = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )
    assert signup.status_code == 201

    response = client.get(
        "/api/v1/me/volunteer-signups",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["signups"][0]["task_name"] == "Setup crew"
    assert body["signups"][0]["event_name"] == "Dashain Celebration"
    assert body["signups"][0]["is_done"] is False


def test_past_event_signups_are_marked_done(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    slot = _create_slot(client, board_member_headers)

    client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )

    event = db_session.get(Event, slot["event_id"])
    event.starts_at = datetime(2020, 6, 1, 18, 0, tzinfo=UTC)
    db_session.commit()

    response = client.get(
        "/api/v1/me/volunteer-signups",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["signups"][0]["is_done"] is True


def test_unauthenticated_request_gets_401(client):
    response = client.get("/api/v1/me/volunteer-signups")
    assert response.status_code == 401


def test_empty_list_when_member_has_no_signups(client, general_member_headers):
    response = client.get(
        "/api/v1/me/volunteer-signups",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json() == {"signups": [], "total": 0}
