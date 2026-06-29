from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reminder import PrepTaskReminder, ReminderType


def due_soon_reminder_exists(
    db: Session,
    *,
    event_task_id: int,
    assignee_id: int,
) -> bool:
    reminder_id = db.scalar(
        select(PrepTaskReminder.id).where(
            PrepTaskReminder.event_task_id == event_task_id,
            PrepTaskReminder.assignee_id == assignee_id,
            PrepTaskReminder.reminder_type == ReminderType.DUE_SOON,
        ),
    )
    return reminder_id is not None


def record_due_soon_reminder(
    db: Session,
    *,
    event_task_id: int,
    assignee_id: int,
    recipient_email: str,
    sent_at: datetime | None = None,
) -> PrepTaskReminder:
    reminder = PrepTaskReminder(
        event_task_id=event_task_id,
        assignee_id=assignee_id,
        reminder_type=ReminderType.DUE_SOON,
        recipient_email=recipient_email,
        sent_at=sent_at or datetime.now(UTC),
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder
