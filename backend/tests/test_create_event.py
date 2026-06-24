from datetime import UTC, datetime
from decimal import Decimal

import pytest

from conftest import auth_header, create_board_member, register_member, set_member_approved

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


def _future_starts_at() -> str:
    return "2030-06-01T18:00:00+00:00"


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": _future_starts_at(),
        "event_type": "cultural",
        "description": "Annual NSA cultural night with food and performances.",
        "budget": "250.00",
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


def test_board_member_can_create_event(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Dashain Celebration"
    assert body["event_type"] == "cultural"
    assert body["description"].startswith("Annual NSA")
    assert body["budget"] == "250.00"
    assert body["starts_at"].startswith("2030-06-01T18:00:00")
    assert body["created_by_id"] == 2


def test_unauthenticated_request_gets_401(client):
    response = client.post("/api/v1/events", json=_event_payload())

    assert response.status_code == 401


def test_general_member_gets_403(client, general_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


@pytest.mark.parametrize(
    "field, value",
    [
        ("name", ""),
        ("description", ""),
        ("event_type", "invalid"),
        ("budget", "-1.00"),
        ("budget", "1000000.00"),
        ("budget", "10.999"),
        ("starts_at", "2030-06-01T18:00:00"),
        ("starts_at", "2020-01-01T18:00:00+00:00"),
    ],
)
def test_create_event_rejects_invalid_input(
    client,
    board_member_headers,
    field,
    value,
):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**{field: value}),
        headers=board_member_headers,
    )

    assert response.status_code == 422


def test_create_event_strips_name_and_description(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(
            name="  Spring Social  ",
            description="  Food and games for members.  ",
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Spring Social"
    assert body["description"] == "Food and games for members."
