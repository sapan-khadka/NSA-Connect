from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionInterestVote(StrEnum):
    INTERESTED = "interested"
    MAYBE = "maybe"
    NOT_INTERESTED = "not_interested"


class EventSuggestionInterest(Base):
    __tablename__ = "event_suggestion_interests"
    __table_args__ = (
        UniqueConstraint(
            "suggestion_id",
            "member_id",
            name="uq_event_suggestion_interests_suggestion_member",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(
        Integer,
        ForeignKey("event_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vote = Column(
        SqlEnum(
            EventSuggestionInterestVote,
            values_callable=lambda types: [item.value for item in types],
            name="eventsuggestioninterestvote",
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

    suggestion = relationship("EventSuggestion", back_populates="interests")
    member = relationship("Member", foreign_keys=[member_id])
