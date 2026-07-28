from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base

MAX_IDEA_COMMENT_LENGTH = 2000
DELETED_IDEA_COMMENT_PLACEHOLDER = "This comment was deleted"


class EventSuggestionCommentChannel(StrEnum):
    COMMUNITY = "community"
    BOARD = "board"


class EventSuggestionComment(Base):
    __tablename__ = "event_suggestion_comments"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(
        Integer,
        ForeignKey("event_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        Integer,
        ForeignKey("event_suggestion_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    channel = Column(
        SqlEnum(
            EventSuggestionCommentChannel,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=False,
        default=EventSuggestionCommentChannel.COMMUNITY,
        server_default=EventSuggestionCommentChannel.COMMUNITY.value,
        index=True,
    )
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    suggestion = relationship("EventSuggestion", back_populates="comments")
    author = relationship("Member", foreign_keys=[author_id])
    parent = relationship(
        "EventSuggestionComment",
        remote_side=[id],
        back_populates="replies",
    )
    replies = relationship(
        "EventSuggestionComment",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
