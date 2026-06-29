from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventTaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class EventTask(Base):
    __tablename__ = "event_tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    assignee_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    status = Column(
        SqlEnum(
            EventTaskStatus,
            values_callable=lambda statuses: [s.value for s in statuses],
        ),
        nullable=False,
        default=EventTaskStatus.TODO,
        server_default=EventTaskStatus.TODO.value,
    )
    due_date = Column(DateTime(timezone=True), nullable=True)
    completion_note = Column(Text, nullable=True)
    completion_photo_url = Column(String(2048), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="event_tasks")
    assignee = relationship("Member", foreign_keys=[assignee_id])
    created_by = relationship("Member", foreign_keys=[created_by_id])
