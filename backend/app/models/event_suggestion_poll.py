from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionPoll(Base):
    __tablename__ = "event_suggestion_polls"
    __table_args__ = (
        UniqueConstraint(
            "suggestion_id",
            name="uq_event_suggestion_polls_suggestion_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(
        Integer,
        ForeignKey("event_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question = Column(String(255), nullable=False)
    is_open = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    suggestion = relationship("EventSuggestion", back_populates="poll")
    created_by = relationship("Member", foreign_keys=[created_by_id])
    options = relationship(
        "EventSuggestionPollOption",
        back_populates="poll",
        cascade="all, delete-orphan",
        order_by="EventSuggestionPollOption.sort_order",
    )
    votes = relationship(
        "EventSuggestionPollVote",
        back_populates="poll",
        cascade="all, delete-orphan",
    )


class EventSuggestionPollOption(Base):
    __tablename__ = "event_suggestion_poll_options"

    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(
        Integer,
        ForeignKey("event_suggestion_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String(120), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    poll = relationship("EventSuggestionPoll", back_populates="options")
    votes = relationship(
        "EventSuggestionPollVote",
        back_populates="option",
        cascade="all, delete-orphan",
    )


class EventSuggestionPollVote(Base):
    __tablename__ = "event_suggestion_poll_votes"
    __table_args__ = (
        UniqueConstraint(
            "poll_id",
            "member_id",
            name="uq_event_suggestion_poll_votes_poll_member",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(
        Integer,
        ForeignKey("event_suggestion_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_id = Column(
        Integer,
        ForeignKey("event_suggestion_poll_options.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    poll = relationship("EventSuggestionPoll", back_populates="votes")
    option = relationship("EventSuggestionPollOption", back_populates="votes")
    member = relationship("Member", foreign_keys=[member_id])
