from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionStatus(StrEnum):
    SUBMITTED = "submitted"
    INTERNAL_REVIEW = "internal_review"
    PUBLISHED = "published"
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
        default=EventSuggestionStatus.SUBMITTED,
        server_default=EventSuggestionStatus.SUBMITTED.value,
    )
    suggested_by_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    noted_at = Column(DateTime(timezone=True), nullable=True)
    noted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    board_note = Column(Text, nullable=True)
    board_note_updated_at = Column(DateTime(timezone=True), nullable=True)
    board_note_updated_by_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    published_at = Column(DateTime(timezone=True), nullable=True)
    community_interest_enabled = Column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    community_discussion_enabled = Column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    community_visibility = Column(
        String(32), nullable=False, default="members", server_default="members"
    )
    community_feedback_closed_at = Column(DateTime(timezone=True), nullable=True)
    converted_event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    view_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    suggested_by = relationship("Member", foreign_keys=[suggested_by_id])
    noted_by = relationship("Member", foreign_keys=[noted_by_id])
    board_note_updated_by = relationship(
        "Member", foreign_keys=[board_note_updated_by_id]
    )
    converted_event = relationship("Event", foreign_keys=[converted_event_id])
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
    views = relationship(
        "EventSuggestionView",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )
    polls = relationship(
        "EventSuggestionPoll",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )
