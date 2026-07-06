from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventType(StrEnum):
    CULTURAL = "cultural"
    MEETING = "meeting"
    FUNDRAISER = "fundraiser"
    SOCIAL = "social"
    SERVICE = "service"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    event_type = Column(
        SqlEnum(
            EventType,
            values_callable=lambda types: [event_type.value for event_type in types],
        ),
        nullable=False,
    )
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(255), nullable=True)
    budget = Column(Numeric(10, 2), nullable=False)
    show_in_photo_archive = Column(Boolean, nullable=False, default=True)
    checkin_token = Column(String(64), nullable=True)
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    rsvps = relationship(
        "EventRsvp",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    volunteer_slots = relationship(
        "VolunteerSlot",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="VolunteerSlot.created_at",
    )
    event_tasks = relationship(
        "EventTask",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventTask.created_at",
    )
    participant_invitations = relationship(
        "EventParticipantInvitation",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    meeting_record = relationship(
        "MeetingRecord",
        back_populates="event",
        cascade="all, delete-orphan",
        uselist=False,
    )
    meeting_attendance = relationship(
        "MeetingAttendance",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    photos = relationship(
        "EventPhoto",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventPhoto.created_at",
    )
    check_ins = relationship(
        "EventCheckIn",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventCheckIn.checked_in_at",
    )
    guest_check_ins = relationship(
        "EventGuestCheckIn",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventGuestCheckIn.checked_in_at",
    )
    volunteer_signups = relationship(
        "EventVolunteerSignup",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventVolunteerSignup.created_at",
    )
    feedback_entries = relationship(
        "EventFeedback",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventFeedback.created_at.desc()",
    )

    @property
    def is_upcoming(self) -> bool:
        from datetime import UTC

        starts_at = self.starts_at
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=UTC)
        else:
            starts_at = starts_at.astimezone(UTC)
        return starts_at >= datetime.now(UTC)
