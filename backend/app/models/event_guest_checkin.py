from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class GuestAffiliationType(StrEnum):
    GUEST_OF_MEMBER = "guest_of_member"
    FACULTY_STAFF = "faculty_staff"


class EventGuestCheckIn(Base):
    __tablename__ = "event_guest_check_ins"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    guest_name = Column(String(255), nullable=False)
    affiliation_type = Column(
        SqlEnum(
            GuestAffiliationType,
            values_callable=lambda types: [item.value for item in types],
        ),
        nullable=True,
    )
    related_member_name = Column(String(255), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=False)

    event = relationship("Event", back_populates="guest_check_ins")
