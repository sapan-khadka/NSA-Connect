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
from app.models.discussion_room_read import MAX_DISCUSSION_ROOM_ID_LENGTH


class DiscussionRoomMute(Base):
    """Per-user mute for discussion/DM notifications."""

    __tablename__ = "discussion_room_mutes"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_room_mutes_user_room",
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
    muted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    user = relationship("Member")
