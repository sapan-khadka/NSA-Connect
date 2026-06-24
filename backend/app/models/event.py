from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum

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
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)

    @property
    def is_upcoming(self) -> bool:
        return self.starts_at >= datetime.now(self.starts_at.tzinfo)
