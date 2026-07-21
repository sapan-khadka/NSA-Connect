from datetime import UTC, datetime, timedelta

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.lib.event_dates import EVENT_DATE_PAST_ERROR

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
    assert body["location"] is None


def test_board_member_can_create_event_with_location(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(location="  University Center  "),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["location"] == "University Center"


def test_board_member_can_create_event_with_capacity(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(capacity=120),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["capacity"] == 120


def test_board_member_can_patch_event_capacity(client, board_member_headers):
    created = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    patched = client.patch(
        f"/api/v1/events/{event_id}",
        json={"capacity": 80},
        headers=board_member_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["capacity"] == 80

    cleared = client.patch(
        f"/api/v1/events/{event_id}",
        json={"capacity": None},
        headers=board_member_headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["capacity"] is None


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


def test_create_meeting_event_hides_from_photo_archive_by_default(
    client,
    board_member_headers,
):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(
            name="March Board Meeting",
            event_type="meeting",
            description="Monthly board meeting agenda and minutes.",
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["show_in_photo_archive"] is False
    assert response.json()["meeting_visibility"] == "board_only"


def test_create_cultural_event_shows_in_photo_archive_by_default(
    client,
    board_member_headers,
):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["show_in_photo_archive"] is True


def test_create_event_rejects_past_calendar_date(client, board_member_headers):
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    past_start = datetime(
        yesterday.year,
        yesterday.month,
        yesterday.day,
        18,
        0,
        tzinfo=UTC,
    )

    response = client.post(
        "/api/v1/events",
        json=_event_payload(starts_at=past_start.isoformat().replace("+00:00", "Z")),
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert EVENT_DATE_PAST_ERROR in response.text


def test_create_meeting_rejects_past_calendar_date(client, board_member_headers):
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    past_start = datetime(
        yesterday.year,
        yesterday.month,
        yesterday.day,
        10,
        0,
        tzinfo=UTC,
    )

    response = client.post(
        "/api/v1/events",
        json=_event_payload(
            name="Past Board Meeting",
            event_type="meeting",
            description="Should not be allowed.",
            starts_at=past_start.isoformat().replace("+00:00", "Z"),
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert EVENT_DATE_PAST_ERROR in response.text


def test_create_event_allows_today_even_if_time_has_passed(
    client, board_member_headers
):
    today = datetime.now(UTC).date()
    today_start = datetime(
        today.year,
        today.month,
        today.day,
        0,
        1,
        tzinfo=UTC,
    )

    response = client.post(
        "/api/v1/events",
        json=_event_payload(
            name="Same-day Event",
            starts_at=today_start.isoformat().replace("+00:00", "Z"),
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 201
