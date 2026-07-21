from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base

MAX_DISCUSSION_ROOM_ID_LENGTH = 64


class DiscussionRoomRead(Base):
    """Per-user last-opened timestamp for a discussion room (inbox unread)."""

    __tablename__ = "discussion_room_reads"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_reads_user_room",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    room_id = Column(String(MAX_DISCUSSION_ROOM_ID_LENGTH), nullable=False, index=True)
    last_read_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    last_read_message_id = Column(
        Integer,
        ForeignKey("discussion_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user = relationship("Member")
    last_read_message = relationship("DiscussionMessage")
