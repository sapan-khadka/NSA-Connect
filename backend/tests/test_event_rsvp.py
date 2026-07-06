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


def test_general_member_can_set_going_rsvp(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    assert event["current_member_rsvp_status"] is None

    response = client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "going"},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["event_id"] == event["id"]
    assert body["current_member_rsvp_status"] == "going"

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["current_member_rsvp_status"] == "going"
    assert "going_count" not in detail.json()
    assert "rsvp_count" not in detail.json()


def test_member_can_change_rsvp_status(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "going"},
        headers=general_member_headers,
    )

    response = client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "maybe"},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["current_member_rsvp_status"] == "maybe"


def test_member_can_clear_rsvp(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "not_going"},
        headers=general_member_headers,
    )

    response = client.delete(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["current_member_rsvp_status"] is None


def test_legacy_post_rsvp_sets_going(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event['id']}/rsvp",
        headers=general_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["current_member_rsvp_status"] == "going"


def test_duplicate_post_rsvp_returns_409(
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


def test_cannot_rsvp_to_past_event(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from datetime import UTC, datetime
    from decimal import Decimal

    from app.models.event import Event, EventType, MeetingVisibility

    event = Event(
        title="Past Event",
        description="Already happened.",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.PUBLIC,
        starts_at=datetime(2020, 1, 1, 18, 0, tzinfo=UTC),
        budget=Decimal("0.00"),
        created_by_id=2,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    response = client.put(
        f"/api/v1/events/{event.id}/rsvp",
        json={"status": "going"},
        headers=general_member_headers,
    )

    assert response.status_code == 422


def test_board_can_list_attendees_general_cannot(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "going"},
        headers=general_member_headers,
    )
    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "maybe"},
        headers=board_member_headers,
    )

    forbidden = client.get(
        f"/api/v1/events/{event['id']}/rsvps",
        headers=general_member_headers,
    )
    assert forbidden.status_code == 403

    allowed = client.get(
        f"/api/v1/events/{event['id']}/rsvps",
        headers=board_member_headers,
    )
    assert allowed.status_code == 200
    body = allowed.json()
    assert body["going_count"] == 1
    assert body["maybe_count"] == 1
    assert body["not_going_count"] == 0
    assert body["no_response_count"] >= 0
    assert len(body["attendees"]) >= 2
    member_types = {attendee["member_type"] for attendee in body["attendees"] if attendee["rsvp_status"] is not None}
    assert "Board member" in member_types or "General member" in member_types
    responded = [a for a in body["attendees"] if a["rsvp_status"] is not None]
    assert len(responded) == 2


def test_attendee_list_is_sorted_alphabetically(
    client,
    db_session,
    board_member_headers,
):
    from sqlalchemy import select

    from app.models.member import Member

    event = _create_event(client, board_member_headers)

    register_member(client, email="zebra@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="zebra@semo.edu")
    register_member(client, email="alpha@semo.edu", student_id="44444444")
    set_member_approved(db_session, email="alpha@semo.edu")

    zebra = db_session.scalar(select(Member).where(Member.email == "zebra@semo.edu"))
    alpha = db_session.scalar(select(Member).where(Member.email == "alpha@semo.edu"))
    zebra.full_name = "Zebra Member"
    alpha.full_name = "Alpha Member"
    db_session.commit()

    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "going"},
        headers=auth_header(client, email="zebra@semo.edu"),
    )
    client.put(
        f"/api/v1/events/{event['id']}/rsvp",
        json={"status": "going"},
        headers=auth_header(client, email="alpha@semo.edu"),
    )

    response = client.get(
        f"/api/v1/events/{event['id']}/rsvps",
        headers=board_member_headers,
    )
    general_names = [
        attendee["full_name"]
        for attendee in response.json()["attendees"]
        if attendee["member_type"] == "General member"
        and attendee["rsvp_status"] == "going"
    ]
    assert general_names == ["Alpha Member", "Zebra Member"]


def test_attendee_list_includes_members_without_response(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.get(
        f"/api/v1/events/{event['id']}/rsvps",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["going_count"] == 0
    assert body["no_response_count"] >= 1
    assert any(attendee["rsvp_status"] is None for attendee in body["attendees"])
