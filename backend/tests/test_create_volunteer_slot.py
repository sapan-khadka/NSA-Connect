import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


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


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_board_member_can_create_volunteer_slot(client, board_member_headers):
    event_id = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event_id
    assert body["task_name"] == "Setup crew"
    assert body["max_signup_count"] == 4
    assert body["signup_count"] == 0
    assert body["spots_remaining"] == 4
    assert body["is_full"] is False
    assert "created_at" in body


def test_board_member_can_list_volunteer_slots(client, board_member_headers):
    event_id = _create_event(client, board_member_headers)
    created = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(description="Arrive early"),
        headers=board_member_headers,
    )
    assert created.status_code == 201

    response = client.get(
        f"/api/v1/events/{event_id}/slots",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["slots"][0]["task_name"] == "Setup crew"
    assert body["slots"][0]["description"] == "Arrive early"


def test_unauthenticated_request_gets_401(client, board_member_headers):
    event_id = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(),
    )

    assert response.status_code == 401


def test_general_member_gets_403(client, general_member_headers, board_member_headers):
    event_id = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(),
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_create_volunteer_slot_returns_404_for_missing_event(
    client, board_member_headers
):
    response = client.post(
        "/api/v1/events/999/slots",
        json=_slot_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"


@pytest.mark.parametrize("max_signup_count", [0, -1])
def test_create_volunteer_slot_rejects_invalid_capacity(
    client,
    board_member_headers,
    max_signup_count,
):
    event_id = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(max_signup_count=max_signup_count),
        headers=board_member_headers,
    )

    assert response.status_code == 422


def test_create_volunteer_slot_rejects_empty_task_name(client, board_member_headers):
    event_id = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(task_name="   "),
        headers=board_member_headers,
    )

    assert response.status_code == 422
