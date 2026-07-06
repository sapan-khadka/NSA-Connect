from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.event import Event, EventType, MeetingVisibility
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member
from app.services.ai_chat_tools import execute_chat_tool
from app.services.notification_scan_service import run_scheduled_notification_checks
from conftest import (
    VALID_EMAIL,
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)


def _event_payload(**overrides):
    payload = {
        "name": "Board Strategy Session",
        "starts_at": "2030-08-01T18:00:00+00:00",
        "event_type": "meeting",
        "description": "Closed board-only planning.",
        "budget": "0.00",
        "meeting_visibility": "board_only",
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


def _create_meeting(client, headers, **overrides):
    return client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )


def test_closed_meeting_hidden_from_general_member_lists(
    client,
    board_member_headers,
    general_member_headers,
):
    create_response = _create_meeting(client, board_member_headers)
    assert create_response.status_code == 201
    event_id = create_response.json()["id"]

    list_response = client.get("/api/v1/events", headers=general_member_headers)
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0

    upcoming_response = client.get("/api/v1/events/upcoming", headers=general_member_headers)
    assert upcoming_response.status_code == 200
    assert upcoming_response.json()["total"] == 0

    detail_response = client.get(f"/api/v1/events/{event_id}", headers=general_member_headers)
    assert detail_response.status_code == 404

    board_list = client.get("/api/v1/events", headers=board_member_headers)
    assert board_list.status_code == 200
    assert board_list.json()["total"] == 1
    assert board_list.json()["events"][0]["id"] == event_id


def test_public_meeting_visible_to_general_members(
    client,
    board_member_headers,
    general_member_headers,
):
    create_response = _create_meeting(
        client,
        board_member_headers,
        name="Open Town Hall",
        meeting_visibility="public",
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["id"]

    list_response = client.get("/api/v1/events", headers=general_member_headers)
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1

    detail_response = client.get(f"/api/v1/events/{event_id}", headers=general_member_headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["name"] == "Open Town Hall"


def test_new_meeting_defaults_to_board_only(client, board_member_headers):
    payload = _event_payload()
    payload.pop("meeting_visibility", None)
    response = client.post(
        "/api/v1/events",
        json=payload,
        headers=board_member_headers,
    )
    assert response.status_code == 201
    assert response.json()["meeting_visibility"] == "board_only"


def test_general_member_cannot_rsvp_to_closed_meeting(
    client,
    board_member_headers,
    general_member_headers,
):
    create_response = _create_meeting(client, board_member_headers)
    event_id = create_response.json()["id"]

    rsvp_response = client.put(
        f"/api/v1/events/{event_id}/rsvp",
        json={"status": "going"},
        headers=general_member_headers,
    )
    assert rsvp_response.status_code == 404


@patch("app.services.notification_email_service.send_resend_email")
def test_closed_meeting_rsvp_nudge_skips_general_members(
    mock_send,
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    mock_send.return_value = "email_1"
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))

    as_of = datetime(2030, 7, 30, 12, 0, tzinfo=UTC)
    create_response = _create_meeting(
        client,
        board_member_headers,
        starts_at=(as_of + timedelta(hours=48)).isoformat().replace("+00:00", "Z"),
    )
    event_id = create_response.json()["id"]

    stats = run_scheduled_notification_checks(db_session, as_of=as_of)
    assert stats["rsvp_nudges"]["sent"] == 1

    general_member = db_session.scalar(
        select(Member).where(Member.email == "sapan@semo.edu"),
    )
    assert general_member is not None
    assert general_member.id != board.id

    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["to_email"] == board.email
    assert mock_send.call_args.kwargs["to_email"] != general_member.email


@patch("app.services.notification_email_service.send_resend_email")
def test_closed_meeting_reminder_skips_general_member_rsvp(
    mock_send,
    db_session,
    client,
    board_member_headers,
    general_member_headers,
):
    mock_send.return_value = "email_1"
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assert board is not None

    as_of = datetime(2030, 7, 30, 12, 0, tzinfo=UTC)
    event = Event(
        title="Closed Session",
        description="Private",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.BOARD_ONLY,
        starts_at=as_of + timedelta(hours=24),
        budget=0,
        created_by_id=board.id,
    )
    db_session.add(event)
    db_session.flush()

    general_member = db_session.scalar(
        select(Member).where(Member.email == "sapan@semo.edu"),
    )
    assert general_member is not None
    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=general_member.id,
            status=RsvpStatus.GOING,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=board.id,
            status=RsvpStatus.GOING,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.commit()

    stats = run_scheduled_notification_checks(db_session, as_of=as_of)
    assert stats["event_reminders"]["sent"] == 1
    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["to_email"] == board.email


def test_ai_tools_hide_closed_meetings_from_general_members(db_session, client):
    register_member(client)
    set_member_approved(db_session)
    general = db_session.scalar(select(Member).where(Member.email == VALID_EMAIL))
    assert general is not None

    board = create_board_member(db_session, email="board@semo.edu")
    closed = Event(
        title="Secret Board Meeting",
        description="Private",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.BOARD_ONLY,
        starts_at=datetime(2030, 9, 1, 18, 0, tzinfo=UTC),
        budget=0,
        created_by_id=board.id,
    )
    public = Event(
        title="Open Community Meeting",
        description="Everyone welcome",
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.PUBLIC,
        starts_at=datetime(2030, 9, 2, 18, 0, tzinfo=UTC),
        budget=0,
        created_by_id=board.id,
    )
    db_session.add_all([closed, public])
    db_session.commit()

    upcoming = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="list_upcoming_events",
        tool_input={"limit": 10},
    )
    assert "Secret Board Meeting" not in upcoming
    assert "Open Community Meeting" in upcoming

    search = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="search_events",
        tool_input={"keyword": "Meeting"},
    )
    assert "Secret Board Meeting" not in search
    assert "Open Community Meeting" in search

    hidden = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="get_event_details",
        tool_input={"event_id": closed.id},
    )
    assert '"error": "not_found"' in hidden or '"error":"not_found"' in hidden
