from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.models.base import Base

MAX_DISCUSSION_CONTENT_LENGTH = 2000


class DiscussionMessage(Base):
    """Async discussion post for an event thread or the board-only channel.

    ``event_id`` set → event-scoped thread.
    ``event_id`` null → board-only general channel.
    """

    __tablename__ = "discussion_messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
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
