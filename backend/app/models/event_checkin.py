from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventCheckIn(Base):
    __tablename__ = "event_check_ins"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "member_id", name="uq_event_check_ins_event_member"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=False)

    event = relationship("Event", back_populates="check_ins")
    member = relationship("Member")
