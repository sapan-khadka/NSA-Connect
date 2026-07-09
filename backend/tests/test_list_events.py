import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)


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
    return client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )


def test_list_events_requires_authentication(client, board_member_headers):
    _create_event(client, board_member_headers)

    response = client.get("/api/v1/events")

    assert response.status_code == 401


def test_list_events_returns_all_when_no_filters(
    client, board_member_headers, general_member_headers
):
    _create_event(
        client,
        board_member_headers,
        name="June Cultural",
        starts_at="2030-06-15T18:00:00+00:00",
        event_type="cultural",
    )
    _create_event(
        client,
        board_member_headers,
        name="July Meeting",
        starts_at="2030-07-10T18:00:00+00:00",
        event_type="meeting",
        description="Monthly board check-in.",
        meeting_visibility="public",
    )

    response = client.get("/api/v1/events", headers=general_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [event["name"] for event in body["events"]] == [
        "June Cultural",
        "July Meeting",
    ]


def test_list_events_filters_by_month(
    client, board_member_headers, general_member_headers
):
    _create_event(
        client,
        board_member_headers,
        name="June Cultural",
        starts_at="2030-06-15T18:00:00+00:00",
        event_type="cultural",
    )
    _create_event(
        client,
        board_member_headers,
        name="July Meeting",
        starts_at="2030-07-10T18:00:00+00:00",
        event_type="meeting",
        description="Monthly board check-in.",
        meeting_visibility="public",
    )

    response = client.get(
        "/api/v1/events",
        params={"month": "2030-06"},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["events"][0]["name"] == "June Cultural"


def test_list_events_filters_by_type(
    client, board_member_headers, general_member_headers
):
    _create_event(
        client,
        board_member_headers,
        name="June Cultural",
        starts_at="2030-06-15T18:00:00+00:00",
        event_type="cultural",
    )
    _create_event(
        client,
        board_member_headers,
        name="June Meeting",
        starts_at="2030-06-20T18:00:00+00:00",
        event_type="meeting",
        description="Monthly board check-in.",
        meeting_visibility="public",
    )

    response = client.get(
        "/api/v1/events",
        params={"event_type": "meeting"},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["events"][0]["name"] == "June Meeting"


def test_list_events_filters_by_month_and_type(
    client,
    board_member_headers,
    general_member_headers,
):
    _create_event(
        client,
        board_member_headers,
        name="June Cultural",
        starts_at="2030-06-15T18:00:00+00:00",
        event_type="cultural",
    )
    _create_event(
        client,
        board_member_headers,
        name="June Meeting",
        starts_at="2030-06-20T18:00:00+00:00",
        event_type="meeting",
        description="Monthly board check-in.",
        meeting_visibility="public",
    )
    _create_event(
        client,
        board_member_headers,
        name="July Meeting",
        starts_at="2030-07-10T18:00:00+00:00",
        event_type="meeting",
        description="Summer planning session.",
        meeting_visibility="public",
    )

    response = client.get(
        "/api/v1/events",
        params={"month": "2030-06", "event_type": "meeting"},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["events"][0]["name"] == "June Meeting"


@pytest.mark.parametrize("month", ["2030-13", "30-06", "2030/06", "invalid"])
def test_list_events_rejects_invalid_month(
    client,
    general_member_headers,
    month,
):
    response = client.get(
        "/api/v1/events",
        params={"month": month},
        headers=general_member_headers,
    )

    assert response.status_code == 422
