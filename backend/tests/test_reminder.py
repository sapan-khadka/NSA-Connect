from datetime import UTC, datetime

from conftest import create_board_member
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.reminder import PrepTaskReminder, ReminderType
from app.services.prep_task_reminder_store import (
    due_soon_reminder_exists,
    record_due_soon_reminder,
)
from tests.helpers.task_fixtures import seed_checklist_event_task


def test_prep_task_reminder_table_name():
    assert PrepTaskReminder.__tablename__ == "prep_task_reminders"


def test_record_and_check_due_soon_reminder(db_session):
    board_member = create_board_member(db_session)
    event = Event(
        title="Dashain Celebration",
        description="Annual cultural night.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        budget=250,
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    task = seed_checklist_event_task(
        db_session,
        event_id=event.id,
        group_name="Setup",
        due_date=datetime(2030, 5, 20, 12, 0, tzinfo=UTC),
        assignee_id=board_member.id,
    )

    record_due_soon_reminder(
        db_session,
        event_task_id=task.id,
        assignee_id=board_member.id,
        recipient_email="board@semo.edu",
        sent_at=datetime(2030, 5, 1, 9, 0, tzinfo=UTC),
    )

    assert due_soon_reminder_exists(
        db_session,
        event_task_id=task.id,
        assignee_id=board_member.id,
    )
    assert not due_soon_reminder_exists(
        db_session,
        event_task_id=task.id,
        assignee_id=99,
    )

    reminder = db_session.scalar(select(PrepTaskReminder))
    assert reminder.reminder_type == ReminderType.DUE_SOON
    assert reminder.recipient_email == "board@semo.edu"
    assert reminder.event_task_id == task.id
