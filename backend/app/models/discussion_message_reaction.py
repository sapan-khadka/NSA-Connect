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

MAX_REACTION_EMOJI_LENGTH = 16


class DiscussionMessageReaction(Base):
    """Emoji reaction on a discussion message (event or board thread)."""

    __tablename__ = "discussion_message_reactions"
    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "user_id",
            "emoji",
            name="uq_discussion_message_reactions_message_user_emoji",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(
        Integer,
        ForeignKey("discussion_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    emoji = Column(String(MAX_REACTION_EMOJI_LENGTH), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    message = relationship("DiscussionMessage", back_populates="reactions")
    user = relationship("Member")
