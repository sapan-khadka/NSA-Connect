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
    author_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
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
