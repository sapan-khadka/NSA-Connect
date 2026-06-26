from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class VolunteerSlot(Base):
    __tablename__ = "volunteer_slots"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_volunteer_slots_capacity_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    capacity = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)

    event = relationship("Event", back_populates="volunteer_slots")
    signups = relationship(
        "VolunteerSignup",
        back_populates="slot",
        cascade="all, delete-orphan",
    )

    @property
    def signup_count(self) -> int:
        return len(self.signups)

    @property
    def spots_remaining(self) -> int:
        return max(self.capacity - self.signup_count, 0)

    @property
    def is_full(self) -> bool:
        return self.signup_count >= self.capacity


class VolunteerSignup(Base):
    __tablename__ = "volunteer_signups"
    __table_args__ = (
        UniqueConstraint("slot_id", "member_id", name="uq_volunteer_signups_slot_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("volunteer_slots.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)

    slot = relationship("VolunteerSlot", back_populates="signups")
    member = relationship("Member")
