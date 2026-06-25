from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventType(StrEnum):
    CULTURAL = "cultural"
    MEETING = "meeting"
    FUNDRAISER = "fundraiser"
    SOCIAL = "social"
    SERVICE = "service"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    event_type = Column(
        SqlEnum(
            EventType,
            values_callable=lambda types: [event_type.value for event_type in types],
        ),
        nullable=False,
    )
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(255), nullable=True)
    budget = Column(Numeric(10, 2), nullable=False)
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    prep_tasks = relationship(
        "PrepTask",
        back_populates="event",
        order_by="PrepTask.due_date",
    )
    rsvps = relationship(
        "EventRsvp",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    @property
    def is_upcoming(self) -> bool:
        return self.starts_at >= datetime.now(self.starts_at.tzinfo)
