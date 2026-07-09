from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionStatus(StrEnum):
    SUBMITTED = "submitted"
    NOTED = "noted"


class EventSuggestion(Base):
    __tablename__ = "event_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    preferred_timing = Column(String(255), nullable=True)
    status = Column(
        SqlEnum(
            EventSuggestionStatus,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=False,
        default=EventSuggestionStatus.SUBMITTED,
        server_default=EventSuggestionStatus.SUBMITTED.value,
    )
    suggested_by_id = Column(
        Integer, ForeignKey("members.id"), nullable=False, index=True
    )
    noted_at = Column(DateTime(timezone=True), nullable=True)
    noted_by_id = Column(Integer, ForeignKey("members.id"), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    suggested_by = relationship("Member", foreign_keys=[suggested_by_id])
    noted_by = relationship("Member", foreign_keys=[noted_by_id])
