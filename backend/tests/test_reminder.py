from datetime import UTC, datetime
from unittest.mock import patch

from sqlalchemy import select

from app.models.reminder import PrepTaskReminder, ReminderType
from app.services.prep_task_reminder_store import (
    due_soon_reminder_exists,
    record_due_soon_reminder,
)


def test_prep_task_reminder_table_name():
    assert PrepTaskReminder.__tablename__ == "prep_task_reminders"


def test_record_and_check_due_soon_reminder(db_session):
    record_due_soon_reminder(
        db_session,
        prep_task_id=1,
        assignee_id=2,
        recipient_email="board@semo.edu",
        sent_at=datetime(2030, 5, 1, 9, 0, tzinfo=UTC),
    )

    assert due_soon_reminder_exists(
        db_session,
        prep_task_id=1,
        assignee_id=2,
    )
    assert not due_soon_reminder_exists(
        db_session,
        prep_task_id=1,
        assignee_id=99,
    )

    reminder = db_session.scalar(select(PrepTaskReminder))
    assert reminder.reminder_type == ReminderType.DUE_SOON
    assert reminder.recipient_email == "board@semo.edu"
