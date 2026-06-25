import pytest

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
    return response.json()


def test_general_member_can_rsvp_to_upcoming_event(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    assert event["rsvp_count"] == 0
    assert event["current_member_has_rsvped"] is False

    response = client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event["id"]
    assert body["rsvp_count"] == 1
    assert body["current_member_has_rsvped"] is True

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["rsvp_count"] == 1
    assert detail.json()["current_member_has_rsvped"] is True


def test_general_member_can_cancel_rsvp(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    response = client.delete(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rsvp_count"] == 0
    assert body["current_member_has_rsvped"] is False


def test_duplicate_rsvp_returns_409(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    response = client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Already RSVPed to this event"


def test_cannot_rsvp_to_past_event(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from datetime import UTC, datetime
    from decimal import Decimal

    from app.models.event import Event, EventType

    event = Event(
        title="Past Event",
        description="Already happened.",
        event_type=EventType.MEETING,
        starts_at=datetime(2020, 1, 1, 18, 0, tzinfo=UTC),
        budget=Decimal("0.00"),
        created_by_id=2,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    response = client.post(
        f"/api/v1/events/{event.id}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Cannot RSVP to a past event"


def test_board_member_can_also_rsvp(
    client,
    board_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["current_member_has_rsvped"] is True
