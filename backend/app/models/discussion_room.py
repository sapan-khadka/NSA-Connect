from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base

MAX_DISCUSSION_ROOM_NAME_LENGTH = 120


class DiscussionRoomStatus(StrEnum):
    PENDING = "pending"
    LIVE = "live"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class DiscussionRoomMemberRole(StrEnum):
    OWNER = "owner"
    MEMBER = "member"


class DiscussionRoom(Base):
    """Named custom discussion group (board-proposed; Pres/VP approve)."""

    __tablename__ = "discussion_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(MAX_DISCUSSION_ROOM_NAME_LENGTH), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        SqlEnum(
            DiscussionRoomStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            name="discussionroomstatus",
        ),
        nullable=False,
        default=DiscussionRoomStatus.PENDING,
        server_default=DiscussionRoomStatus.PENDING.value,
        index=True,
    )
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    reviewed_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_by = relationship("Member", foreign_keys=[created_by_id])
    reviewed_by = relationship("Member", foreign_keys=[reviewed_by_id])
    members = relationship(
        "DiscussionRoomMember",
        back_populates="room",
        cascade="all, delete-orphan",
    )


class DiscussionRoomMember(Base):
    __tablename__ = "discussion_room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "member_id", name="uq_discussion_room_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(
        Integer,
        ForeignKey("discussion_rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id = Column(
        Integer,
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(
        SqlEnum(
            DiscussionRoomMemberRole,
            values_callable=lambda roles: [role.value for role in roles],
            name="discussionroommemberrole",
        ),
        nullable=False,
        default=DiscussionRoomMemberRole.MEMBER,
        server_default=DiscussionRoomMemberRole.MEMBER.value,
    )
    added_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    room = relationship("DiscussionRoom", back_populates="members")
    member = relationship("Member", foreign_keys=[member_id])
