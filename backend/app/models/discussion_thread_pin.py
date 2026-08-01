from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class DiscussionThreadPin(Base):
    """One pinned message per discussion room_key (board / event:N / room:N)."""

    __tablename__ = "discussion_thread_pins"
    __table_args__ = (
        UniqueConstraint("room_key", name="uq_discussion_thread_pins_room_key"),
    )

    id = Column(Integer, primary_key=True)
    room_key = Column(String(64), nullable=False, index=True)
    message_id = Column(
        Integer,
        ForeignKey("discussion_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pinned_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    pinned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    message = relationship("DiscussionMessage")
    pinned_by = relationship("Member")
