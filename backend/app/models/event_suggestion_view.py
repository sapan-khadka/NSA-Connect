from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventSuggestionView(Base):
    __tablename__ = "event_suggestion_views"
    __table_args__ = (
        UniqueConstraint(
            "suggestion_id",
            "member_id",
            name="uq_event_suggestion_views_suggestion_member",
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
    viewed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    suggestion = relationship("EventSuggestion", back_populates="views")
    member = relationship("Member", foreign_keys=[member_id])
