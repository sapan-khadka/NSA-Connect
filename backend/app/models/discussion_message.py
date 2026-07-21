from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.models.base import Base

MAX_DISCUSSION_CONTENT_LENGTH = 2000


class DiscussionMessage(Base):
    """Async discussion post for board, event, or custom room threads.

    Board: ``event_id`` null and ``custom_room_id`` null.
    Event: ``event_id`` set and ``custom_room_id`` null.
    Custom room: ``custom_room_id`` set and ``event_id`` null.
    """

    __tablename__ = "discussion_messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    custom_room_id = Column(
        Integer,
        ForeignKey("discussion_rooms.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    author = relationship("Member")
    event = relationship("Event")
    custom_room = relationship("DiscussionRoom")
    reactions = relationship(
        "DiscussionMessageReaction",
        back_populates="message",
        cascade="all, delete-orphan",
    )
