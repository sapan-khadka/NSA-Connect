from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventVolunteerSignupStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EventVolunteerSignup(Base):
    __tablename__ = "event_volunteer_signups"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_volunteer_signups_event_member",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    note = Column(Text, nullable=True)
    status = Column(
        Enum(
            EventVolunteerSignupStatus,
            name="eventvolunteersignupstatus",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        default=EventVolunteerSignupStatus.PENDING,
        server_default=EventVolunteerSignupStatus.PENDING.value,
        index=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="volunteer_signups")
    member = relationship("Member", foreign_keys=[member_id])
    reviewed_by = relationship("Member", foreign_keys=[reviewed_by_id])
