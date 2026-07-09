from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from conftest import create_board_member

from app.models.event import Event, EventType
from app.services.prep_task_reminder_service import (
    list_incomplete_checklist_tasks_due_within,
    scan_and_notify_prep_tasks_due_soon,
)
from app.services.prep_task_reminder_store import (
    due_soon_reminder_exists,
    record_due_soon_reminder,
)
from tests.helpers.task_fixtures import seed_checklist_event_task


def _seed_event(
    db_session, *, board_member_id: int, title: str = "Dashain Celebration"
):
    event = Event(
        title=title,
        description="Annual cultural night.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        budget=250,
        created_by_id=board_member_id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session)


def test_list_incomplete_checklist_tasks_due_within_returns_tasks_in_window(
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    due_soon = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Setup",
        due_date=now + timedelta(days=2),
    )
    seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Too Far",
        due_date=now + timedelta(days=10),
    )
    seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Complete",
        due_date=now + timedelta(days=1),
        completed=True,
    )
    seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Overdue",
        due_date=now - timedelta(days=1),
    )

    tasks = list_incomplete_checklist_tasks_due_within(db_session, days=3, as_of=now)

    assert [task.id for task in tasks] == [due_soon.id]


def test_list_incomplete_checklist_tasks_due_within_includes_due_on_window_end(
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    due_on_end = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Window End",
        due_date=now + timedelta(days=3),
    )

    tasks = list_incomplete_checklist_tasks_due_within(db_session, days=3, as_of=now)

    assert [task.id for task in tasks] == [due_on_end.id]


@patch("app.tasks.email_tasks.send_prep_task_due_soon_email_task")
def test_scan_and_notify_queues_email_for_assigned_incomplete_tasks(
    mock_delay,
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    assigned_task = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Food",
        due_date=now + timedelta(days=2),
        assignee_id=board_member.id,
    )
    seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Unassigned",
        due_date=now + timedelta(days=2),
        assignee_id=None,
    )

    result = scan_and_notify_prep_tasks_due_soon(db_session, as_of=now)

    assert result["emails_queued"] == 1
    assert result["skipped_unassigned"] == 1
    mock_delay.delay.assert_called_once()
    call_kwargs = mock_delay.delay.call_args.kwargs
    assert call_kwargs["event_task_id"] == assigned_task.id
    assert call_kwargs["assignee_id"] == board_member.id


@patch("app.tasks.email_tasks.send_prep_task_due_soon_email_task")
def test_scan_and_notify_skips_already_sent_reminders(
    mock_delay,
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    assigned_task = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Food",
        due_date=now + timedelta(days=2),
        assignee_id=board_member.id,
    )
    record_due_soon_reminder(
        db_session,
        event_task_id=assigned_task.id,
        assignee_id=board_member.id,
        recipient_email=board_member.email,
    )

    result = scan_and_notify_prep_tasks_due_soon(db_session, as_of=now)

    assert result["skipped_already_sent"] == 1
    assert result["emails_queued"] == 0
    mock_delay.delay.assert_not_called()


def test_due_soon_reminder_exists(db_session, board_member):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)
    task = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Food",
        due_date=now + timedelta(days=2),
        assignee_id=board_member.id,
    )

    record_due_soon_reminder(
        db_session,
        event_task_id=task.id,
        assignee_id=board_member.id,
        recipient_email=board_member.email,
    )

    assert due_soon_reminder_exists(
        db_session,
        event_task_id=task.id,
        assignee_id=board_member.id,
    )
    assert not due_soon_reminder_exists(
        db_session,
        event_task_id=task.id,
        assignee_id=999,
    )
