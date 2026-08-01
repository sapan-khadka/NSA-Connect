from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class DiscussionMessageAttachment(Base):
    __tablename__ = "discussion_message_attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(
        Integer,
        ForeignKey("discussion_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(16), nullable=False)
    file_name = Column(String(512), nullable=False)
    content_type = Column(String(128), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    url = Column(String(2048), nullable=False)
    public_id = Column(String(512), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    message = relationship("DiscussionMessage", back_populates="attachments")
