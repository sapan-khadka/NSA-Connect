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


class DiscussionReadState(Base):
    """Per-user read watermark for an event or board discussion room."""

    __tablename__ = "discussion_read_state"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "room_id",
            name="uq_discussion_read_state_user_room",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    room_id = Column(String(MAX_DISCUSSION_ROOM_ID_LENGTH), nullable=False, index=True)
    last_read_message_id = Column(
        Integer,
        ForeignKey("discussion_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user = relationship("Member")
    last_read_message = relationship("DiscussionMessage")
