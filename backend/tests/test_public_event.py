from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import create_board_member
from sqlalchemy import select

from app.models.event import Event, EventType, MeetingVisibility
from app.models.member import Member


@pytest.fixture
def board_member(db_session):
    create_board_member(db_session)
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assert board is not None
    return board


@pytest.fixture
def public_cultural_event(db_session, board_member):
    event = Event(
        title="Dashain Night",
        description="Cultural celebration with food and performances.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 10, 1, 18, 0, tzinfo=UTC),
        location="University Center",
        budget=Decimal("200.00"),
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


@pytest.fixture
def closed_board_meeting(db_session, board_member):
    event = Event(
        title="Closed Board Meeting",
        description="Internal agenda.",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.BOARD_ONLY,
        starts_at=datetime(2030, 10, 2, 18, 0, tzinfo=UTC),
        budget=Decimal("0.00"),
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


@pytest.fixture
def open_meeting(db_session, board_member):
    event = Event(
        title="Open All-Hands",
        description="Open meeting for all members.",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.PUBLIC,
        starts_at=datetime(2030, 10, 3, 18, 0, tzinfo=UTC),
        budget=Decimal("0.00"),
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def test_public_event_is_available_without_auth(client, public_cultural_event):
    response = client.get(f"/api/v1/public/events/{public_cultural_event.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == public_cultural_event.id
    assert body["name"] == "Dashain Night"
    assert body["location"] == "University Center"
    assert body["event_type"] == "cultural"
    assert "budget" not in body
    assert "created_by_id" not in body
    assert "checkin_token" not in body


def test_public_event_hides_closed_board_meetings(client, closed_board_meeting):
    response = client.get(f"/api/v1/public/events/{closed_board_meeting.id}")
    assert response.status_code == 404


def test_public_event_allows_open_meetings(client, open_meeting):
    response = client.get(f"/api/v1/public/events/{open_meeting.id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Open All-Hands"


def test_public_event_returns_404_for_missing(client):
    response = client.get("/api/v1/public/events/999999")
    assert response.status_code == 404
