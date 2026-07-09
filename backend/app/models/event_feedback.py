from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventFeedback(Base):
    __tablename__ = "event_feedback"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_feedback_event_member",
        ),
        CheckConstraint(
            "rating >= 1 AND rating <= 5", name="ck_event_feedback_rating_range"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="feedback_entries")
    member = relationship("Member")
