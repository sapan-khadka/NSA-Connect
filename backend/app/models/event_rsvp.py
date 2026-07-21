from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class RsvpStatus(StrEnum):
    GOING = "going"
    MAYBE = "maybe"
    NOT_GOING = "not_going"
    WAITLISTED = "waitlisted"


class EventRsvp(Base):
    __tablename__ = "event_rsvps"
    __table_args__ = (
        UniqueConstraint("event_id", "member_id", name="uq_event_rsvps_event_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        SqlEnum(
            RsvpStatus, values_callable=lambda statuses: [s.value for s in statuses]
        ),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="rsvps")
    member = relationship("Member")
