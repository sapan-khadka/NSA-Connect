from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from app.models.event import Event, EventType
from app.models.preptask import PrepTask, PrepTaskChecklistItem, PrepTaskGroup
from app.services.prep_task_reminder_store import (
    due_soon_reminder_exists,
    record_due_soon_reminder,
)
from app.services.prep_task_reminder_service import (
    list_incomplete_prep_tasks_due_within,
    scan_and_notify_prep_tasks_due_soon,
)
from conftest import create_board_member


def _seed_event(db_session, *, board_member_id: int, title: str = "Dashain Celebration"):
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


def _seed_prep_task(
    db_session,
    *,
    event_id: int,
    group_name: str,
    due_date: datetime,
    assignee_id: int | None = None,
    completed: bool = False,
):
    group = PrepTaskGroup(group_name=group_name)
    db_session.add(group)
    db_session.flush()

    prep_task = PrepTask(
        event_id=event_id,
        group_id=group.id,
        due_date=due_date,
        assignee_id=assignee_id,
        checklist_items=[
            PrepTaskChecklistItem(
                label="Checklist item",
                sort_order=0,
                is_completed=completed,
            ),
        ],
    )
    db_session.add(prep_task)
    db_session.commit()
    db_session.refresh(prep_task)
    return prep_task


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session)


def test_list_incomplete_prep_tasks_due_within_returns_tasks_in_window(
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    due_soon = _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Setup",
        due_date=now + timedelta(days=2),
    )
    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Too Far",
        due_date=now + timedelta(days=10),
    )
    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Complete",
        due_date=now + timedelta(days=1),
        completed=True,
    )
    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Overdue",
        due_date=now - timedelta(days=1),
    )

    tasks = list_incomplete_prep_tasks_due_within(db_session, days=3, as_of=now)

    assert len(tasks) == 1
    assert tasks[0].id == due_soon.id


def test_list_incomplete_prep_tasks_due_within_includes_due_on_window_end(
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)

    due_on_end = _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Setup",
        due_date=now + timedelta(days=3),
    )

    tasks = list_incomplete_prep_tasks_due_within(db_session, days=3, as_of=now)

    assert len(tasks) == 1
    assert tasks[0].id == due_on_end.id


@patch("app.tasks.email_tasks.send_prep_task_due_soon_email_task.delay")
def test_scan_and_notify_queues_one_email_per_assigned_task(
    mock_queue_email,
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)
    due_date = now + timedelta(days=1)

    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Setup",
        due_date=due_date,
        assignee_id=board_member.id,
    )
    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Food & Beverage",
        due_date=due_date + timedelta(days=1),
        assignee_id=board_member.id,
    )

    result = scan_and_notify_prep_tasks_due_soon(db_session, as_of=now)

    assert result == {
        "scanned": 2,
        "emails_queued": 2,
        "skipped_unassigned": 0,
        "skipped_already_sent": 0,
    }
    assert mock_queue_email.call_count == 2


@patch("app.tasks.email_tasks.send_prep_task_due_soon_email_task.delay")
def test_scan_and_notify_prep_tasks_due_soon_queues_email_per_task(
    mock_queue_email,
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)
    due_date = now + timedelta(days=2)

    assigned_task = _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Food & Beverage",
        due_date=due_date,
        assignee_id=board_member.id,
    )
    _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Unassigned",
        due_date=due_date,
        assignee_id=None,
    )

    result = scan_and_notify_prep_tasks_due_soon(db_session, as_of=now)

    assert result == {
        "scanned": 2,
        "emails_queued": 1,
        "skipped_unassigned": 1,
        "skipped_already_sent": 0,
    }
    mock_queue_email.assert_called_once_with(
        prep_task_id=assigned_task.id,
        assignee_id=board_member.id,
        email=board_member.email,
        full_name=board_member.full_name,
        event_title=event.title,
        group_name="Food & Beverage",
        due_date_iso=assigned_task.due_date.isoformat(),
    )


@patch("app.tasks.email_tasks.send_prep_task_due_soon_email_task.delay")
def test_scan_and_notify_skips_tasks_with_existing_reminder(
    mock_queue_email,
    db_session,
    board_member,
):
    event = _seed_event(db_session, board_member_id=board_member.id)
    now = datetime(2030, 5, 1, 12, 0, tzinfo=UTC)
    due_date = now + timedelta(days=2)

    assigned_task = _seed_prep_task(
        db_session,
        event_id=event.id,
        group_name="Food & Beverage",
        due_date=due_date,
        assignee_id=board_member.id,
    )
    record_due_soon_reminder(
        db_session,
        prep_task_id=assigned_task.id,
        assignee_id=board_member.id,
        recipient_email=board_member.email,
    )

    result = scan_and_notify_prep_tasks_due_soon(db_session, as_of=now)

    assert result == {
        "scanned": 1,
        "emails_queued": 0,
        "skipped_unassigned": 0,
        "skipped_already_sent": 1,
    }
    mock_queue_email.assert_not_called()
    assert due_soon_reminder_exists(
        db_session,
        prep_task_id=assigned_task.id,
        assignee_id=board_member.id,
    )
