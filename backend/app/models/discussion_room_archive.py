from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.discussion_room_read import MAX_DISCUSSION_ROOM_ID_LENGTH


class DiscussionRoomArchive(Base):
    """Org-wide archive marker for board / event discussion rooms (string room_id)."""

    __tablename__ = "discussion_room_archives"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(
        String(MAX_DISCUSSION_ROOM_ID_LENGTH),
        nullable=False,
        unique=True,
        index=True,
    )
    archived_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    archived_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    archived_by = relationship("Member")
