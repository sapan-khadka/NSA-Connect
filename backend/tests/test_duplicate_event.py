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
        "location": "University Center",
        "capacity": 150,
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_board_can_duplicate_event_with_slots(client, board_member_headers):
    source = _create_event(client, board_member_headers)
    event_id = source["id"]

    slot = client.post(
        f"/api/v1/events/{event_id}/slots",
        json={"task_name": "Setup crew", "max_signup_count": 4},
        headers=board_member_headers,
    )
    assert slot.status_code == 201

    duplicated = client.post(
        f"/api/v1/events/{event_id}/duplicate",
        json={
            "starts_at": "2030-10-01T18:00:00+00:00",
            "name": "Dashain Celebration 2030",
        },
        headers=board_member_headers,
    )

    assert duplicated.status_code == 201
    body = duplicated.json()
    assert body["id"] != event_id
    assert body["name"] == "Dashain Celebration 2030"
    assert body["location"] == "University Center"
    assert body["capacity"] == 150
    assert body["starts_at"].startswith("2030-10-01T18:00:00")

    slots = client.get(
        f"/api/v1/events/{body['id']}/slots",
        headers=board_member_headers,
    )
    assert slots.status_code == 200
    assert slots.json()["total"] == 1
    assert slots.json()["slots"][0]["task_name"] == "Setup crew"
    assert slots.json()["slots"][0]["signup_count"] == 0


def test_duplicate_defaults_copy_name(client, board_member_headers):
    source = _create_event(client, board_member_headers)

    duplicated = client.post(
        f"/api/v1/events/{source['id']}/duplicate",
        json={"starts_at": "2030-11-01T18:00:00+00:00"},
        headers=board_member_headers,
    )

    assert duplicated.status_code == 201
    assert duplicated.json()["name"] == "Dashain Celebration (Copy)"


def test_member_cannot_duplicate_event(client, board_member_headers, general_member_headers):
    source = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{source['id']}/duplicate",
        json={"starts_at": "2030-11-01T18:00:00+00:00"},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL
