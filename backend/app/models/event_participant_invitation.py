from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventParticipantInvitation(Base):
    __tablename__ = "event_participant_invitations"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_participant_invitations_event_member",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    invited_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)

    event = relationship("Event", back_populates="participant_invitations")
    member = relationship("Member", foreign_keys=[member_id])
    invited_by = relationship("Member", foreign_keys=[invited_by_id])
