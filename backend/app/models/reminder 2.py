from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Enum as SqlEnum

from app.models.base import Base


class ReminderType(StrEnum):
    DUE_SOON = "due_soon"


class PrepTaskReminder(Base):
    __tablename__ = "prep_task_reminders"
    __table_args__ = (
        UniqueConstraint(
            "event_task_id",
            "reminder_type",
            "assignee_id",
            name="uq_event_task_reminders_task_type_assignee",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_task_id = Column(Integer, ForeignKey("event_tasks.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    reminder_type = Column(
        SqlEnum(
            ReminderType,
            values_callable=lambda types: [
                reminder_type.value for reminder_type in types
            ],
        ),
        nullable=False,
    )
    recipient_email = Column(String(255), nullable=False)
    sent_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
