from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class RsvpStatus(StrEnum):
    GOING = "going"
    MAYBE = "maybe"
    NOT_GOING = "not_going"


class EventRsvp(Base):
    __tablename__ = "event_rsvps"
    __table_args__ = (
        UniqueConstraint("event_id", "member_id", name="uq_event_rsvps_event_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    status = Column(
        SqlEnum(RsvpStatus, values_callable=lambda statuses: [s.value for s in statuses]),
        nullable=False,
        default=RsvpStatus.GOING,
    )
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    event = relationship("Event", back_populates="rsvps")
    member = relationship("Member")
