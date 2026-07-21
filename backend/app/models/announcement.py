from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class AnnouncementCategory(StrEnum):
    GENERAL = "general"
    URGENT = "urgent"
    EVENT_RELATED = "event_related"


class AnnouncementAudience(StrEnum):
    ALL_APPROVED = "all_approved"
    GOING = "going"
    MAYBE = "maybe"
    NO_RSVP = "no_rsvp"


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(
        SqlEnum(
            AnnouncementCategory,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=False,
        default=AnnouncementCategory.GENERAL,
        server_default=AnnouncementCategory.GENERAL.value,
    )
    audience = Column(
        String(32),
        nullable=False,
        default=AnnouncementAudience.ALL_APPROVED.value,
        server_default=AnnouncementAudience.ALL_APPROVED.value,
    )
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    author = relationship("Member")
    event = relationship("Event")
