from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class MemberNote(Base):
    """Private officer notes about a member. Not visible to the subject."""

    __tablename__ = "member_notes"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer,
        ForeignKey("members.id"),
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)
    pinned = Column(Boolean, nullable=False, server_default="false", default=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    member = relationship("Member", foreign_keys=[member_id])
    author = relationship("Member", foreign_keys=[author_id])
