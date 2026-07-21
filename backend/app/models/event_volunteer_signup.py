from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


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
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="volunteer_signups")
    member = relationship("Member")
