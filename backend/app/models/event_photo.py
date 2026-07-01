from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventPhoto(Base):
    __tablename__ = "event_photos"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    image_url = Column(String(2048), nullable=False)
    thumbnail_url = Column(String(2048), nullable=False)
    public_id = Column(String(512), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    event = relationship("Event", back_populates="photos")
    uploaded_by = relationship("Member")
