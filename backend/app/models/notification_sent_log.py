from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class NotificationType(StrEnum):
    EVENT_REMINDER = "event_reminder"
    RSVP_NUDGE = "rsvp_nudge"
    TASK_DUE_REMINDER = "task_due_reminder"
    TASK_ASSIGNED = "task_assigned"
    DUES_REMINDER = "dues_reminder"
    ANNOUNCEMENT = "announcement"


SCHEDULED_NOTIFICATION_TYPES = frozenset(
    {
        NotificationType.EVENT_REMINDER,
        NotificationType.RSVP_NUDGE,
        NotificationType.TASK_DUE_REMINDER,
        NotificationType.DUES_REMINDER,
    },
)


class NotificationSentLog(Base):
    __tablename__ = "notification_sent_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    notification_type = Column(
        SqlEnum(
            NotificationType,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=False,
    )
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True, index=True)
    event_task_id = Column(
        Integer, ForeignKey("event_tasks.id"), nullable=True, index=True
    )
    announcement_id = Column(
        Integer, ForeignKey("announcements.id"), nullable=True, index=True
    )
    semester = Column(String(16), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=False)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    member = relationship("Member")
    event = relationship("Event")
    event_task = relationship("EventTask")
    announcement = relationship("Announcement")
