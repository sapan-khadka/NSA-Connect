from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class MeetingAttendanceStatus(StrEnum):
    PRESENT = "present"
    ABSENT = "absent"
    EXCUSED = "excused"


class MeetingRecord(Base):
    __tablename__ = "meeting_records"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, unique=True)
    raw_notes = Column(Text, nullable=False, default="")
    summary = Column(Text, nullable=True)
    key_decisions = Column(JSON, nullable=False, default=list)
    action_items = Column(JSON, nullable=False, default=list)
    updated_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="meeting_record")
    updated_by = relationship("Member", foreign_keys=[updated_by_id])


class MeetingAttendance(Base):
    __tablename__ = "meeting_attendance"
    __table_args__ = (
        UniqueConstraint("event_id", "member_id", name="uq_meeting_attendance_event_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    status = Column(
        SqlEnum(
            MeetingAttendanceStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
        nullable=False,
    )
    updated_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="meeting_attendance")
    member = relationship("Member", foreign_keys=[member_id])
    updated_by = relationship("Member", foreign_keys=[updated_by_id])
