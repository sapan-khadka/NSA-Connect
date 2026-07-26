from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    UNDER_DISCUSSION = "under_discussion"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED = "converted"
    ARCHIVED = "archived"


class EventSuggestion(Base):
    __tablename__ = "event_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    preferred_timing = Column(String(255), nullable=True)
    status = Column(
        SqlEnum(
            EventSuggestionStatus,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=False,
        default=EventSuggestionStatus.PENDING_REVIEW,
        server_default=EventSuggestionStatus.PENDING_REVIEW.value,
    )
    suggested_by_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    noted_at = Column(DateTime(timezone=True), nullable=True)
    noted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    suggested_by = relationship("Member", foreign_keys=[suggested_by_id])
    noted_by = relationship("Member", foreign_keys=[noted_by_id])
    interests = relationship(
        "EventSuggestionInterest",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )
    comments = relationship(
        "EventSuggestionComment",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )
