from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.event_task import EventTask, EventTaskKind, EventTaskStatus
from app.models.member import Member
from app.services.notification_scan_service import run_scheduled_notification_checks
from conftest import auth_header, create_board_member, register_member, set_member_approved


def _create_event(db, *, starts_at: datetime, creator_id: int, title: str = "Test Event") -> Event:
    event = Event(
        title=title,
        description="Test description",
        event_type=EventType.CULTURAL,
        location="Student Center",
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=2),
        budget=0,
        created_by_id=creator_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@pytest.fixture
def approved_member(db_session, client):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "member@semo.edu"))


@patch("app.services.notification_email_service.send_resend_email")
def test_event_reminder_sends_to_going_and_maybe(mock_send, db_session, approved_member):
    board = create_board_member(db_session, email="board@semo.edu")
    mock_send.return_value = "email_1"

    as_of = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    event = _create_event(
        db_session,
        starts_at=as_of + timedelta(hours=24),
        creator_id=board.id,
    )

    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=approved_member.id,
            status=RsvpStatus.GOING,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=board.id,
            status=RsvpStatus.MAYBE,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.commit()

    summary = run_scheduled_notification_checks(db_session, as_of=as_of)

    assert summary["event_reminders"]["sent"] == 2
    assert mock_send.call_count == 2


@patch("app.services.notification_email_service.send_resend_email")
def test_running_check_twice_does_not_resend(mock_send, db_session, approved_member):
    board = create_board_member(db_session, email="board@semo.edu")
    mock_send.return_value = "email_1"
    as_of = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    event = _create_event(
        db_session,
        starts_at=as_of + timedelta(hours=24),
        creator_id=board.id,
    )
    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=approved_member.id,
            status=RsvpStatus.GOING,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.commit()

    run_scheduled_notification_checks(db_session, as_of=as_of)
    run_scheduled_notification_checks(db_session, as_of=as_of)

    assert mock_send.call_count == 1


@patch("app.services.notification_email_service.send_resend_email")
def test_event_reminder_respects_preferences(mock_send, db_session, approved_member):
    board = create_board_member(db_session, email="board@semo.edu")
    mock_send.return_value = "email_1"
    approved_member.notify_event_reminders = False
    db_session.commit()

    as_of = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    event = _create_event(
        db_session,
        starts_at=as_of + timedelta(hours=24),
        creator_id=board.id,
    )
    db_session.add(
        EventRsvp(
            event_id=event.id,
            member_id=approved_member.id,
            status=RsvpStatus.GOING,
            created_at=as_of,
            updated_at=as_of,
        ),
    )
    db_session.commit()

    summary = run_scheduled_notification_checks(db_session, as_of=as_of)

    assert summary["event_reminders"]["sent"] == 0
    mock_send.assert_not_called()


@patch("app.services.notification_email_service.send_resend_email")
def test_rsvp_nudge_targets_members_without_response(mock_send, db_session, approved_member):
    board = create_board_member(db_session, email="board@semo.edu")
    mock_send.return_value = "email_1"
    as_of = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    _create_event(
        db_session,
        starts_at=as_of + timedelta(hours=48),
        creator_id=board.id,
    )

    summary = run_scheduled_notification_checks(db_session, as_of=as_of)

    assert summary["rsvp_nudges"]["sent"] >= 1
    mock_send.assert_called()


@patch("app.services.notification_email_service.send_resend_email")
def test_task_due_reminder_sends_to_assignee(mock_send, db_session):
    mock_send.return_value = "email_1"
    board = create_board_member(db_session, email="board@semo.edu")
    as_of = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    event = _create_event(
        db_session,
        starts_at=as_of + timedelta(days=5),
        creator_id=board.id,
    )
    task = EventTask(
        event_id=event.id,
        task_kind=EventTaskKind.SIMPLE,
        title="Buy supplies",
        description="",
        assignee_id=board.id,
        due_date=as_of + timedelta(hours=24),
        status=EventTaskStatus.TODO,
        created_by_id=board.id,
    )
    db_session.add(task)
    db_session.commit()

    summary = run_scheduled_notification_checks(db_session, as_of=as_of)

    assert summary["task_due_reminders"]["sent"] == 1
    mock_send.assert_called_once()


def test_run_check_endpoint_is_board_only(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    response = client.post(
        "/api/v1/notifications/run-check",
        headers=auth_header(client),
        json={},
    )
    assert response.status_code == 403


@patch("app.api.v1.notifications.run_scheduled_notification_checks")
def test_run_check_endpoint_runs_scan(mock_run, client, db_session):
    create_board_member(db_session)
    mock_run.return_value = {
        "checked_at": "2026-07-01T12:00:00+00:00",
        "event_reminders": {"candidates": 0, "sent": 0, "skipped": 0},
        "rsvp_nudges": {"candidates": 0, "sent": 0, "skipped": 0},
        "task_due_reminders": {"candidates": 0, "sent": 0, "skipped": 0},
    }

    response = client.post(
        "/api/v1/notifications/run-check",
        headers=auth_header(client, email="board@semo.edu"),
        json={},
    )

    assert response.status_code == 200
    mock_run.assert_called_once()
