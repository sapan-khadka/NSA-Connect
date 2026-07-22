from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class InboxNotificationType(StrEnum):
    MEMBER_PENDING = "member_pending"
    MEMBER_APPROVED = "member_approved"
    FINANCE_CHANGE_PENDING = "finance_change_pending"
    FINANCE_CHANGE_RESOLVED = "finance_change_resolved"
    SUGGESTION_SUBMITTED = "suggestion_submitted"
    SUGGESTION_NOTED = "suggestion_noted"
    TASK_ASSIGNED = "task_assigned"
    TASK_DUE_REMINDER = "task_due_reminder"
    ANNOUNCEMENT = "announcement"
    VOLUNTEER_SIGNUP = "volunteer_signup"
    VOLUNTEER_SIGNUP_REVIEWED = "volunteer_signup_reviewed"


class InboxNotification(Base):
    __tablename__ = "inbox_notifications"
    __table_args__ = (
        UniqueConstraint(
            "member_id",
            "dedupe_key",
            name="uq_inbox_notifications_member_dedupe",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    member_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    href = Column(String(500), nullable=True)
    dedupe_key = Column(String(255), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    member = relationship("Member")
