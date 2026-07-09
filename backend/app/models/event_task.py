from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class EventTaskKind(StrEnum):
    SIMPLE = "simple"
    CHECKLIST = "checklist"


class EventTaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class EventTaskChecklistItem(Base):
    __tablename__ = "event_task_checklist_items"
    __table_args__ = (
        UniqueConstraint(
            "event_task_id",
            "sort_order",
            name="uq_event_task_checklist_order",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_task_id = Column(Integer, ForeignKey("event_tasks.id"), nullable=False)
    label = Column(String(255), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    event_task = relationship("EventTask", back_populates="checklist_items")


class EventTask(Base):
    __tablename__ = "event_tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    task_kind = Column(
        SqlEnum(
            EventTaskKind,
            values_callable=lambda kinds: [kind.value for kind in kinds],
        ),
        nullable=False,
        default=EventTaskKind.SIMPLE,
        server_default=EventTaskKind.SIMPLE.value,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    group_id = Column(Integer, ForeignKey("prep_task_groups.id"), nullable=True)
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
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    event = relationship("Event", back_populates="event_tasks")
    assignee = relationship("Member", foreign_keys=[assignee_id])
    created_by = relationship("Member", foreign_keys=[created_by_id])
    group = relationship("PrepTaskGroup")
    checklist_items = relationship(
        "EventTaskChecklistItem",
        back_populates="event_task",
        order_by="EventTaskChecklistItem.sort_order",
        cascade="all, delete-orphan",
    )

    @property
    def is_overdue(self) -> bool:
        if self.due_date is None:
            return False
        due = self.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=UTC)
        return due < datetime.now(UTC)

    @property
    def is_checklist_complete(self) -> bool:
        if self.task_kind != EventTaskKind.CHECKLIST:
            return self.status == EventTaskStatus.DONE
        if not self.checklist_items:
            return False
        return all(item.is_completed for item in self.checklist_items)


def checklist_items_from_labels(labels: list[str]) -> list[EventTaskChecklistItem]:
    return [
        EventTaskChecklistItem(label=label, sort_order=index)
        for index, label in enumerate(labels)
    ]


def checklist_items_from_group(group) -> list[EventTaskChecklistItem]:
    return [
        EventTaskChecklistItem(label=item.label, sort_order=item.sort_order)
        for item in group.items
    ]


def sync_checklist_status(task: EventTask) -> None:
    if task.task_kind != EventTaskKind.CHECKLIST:
        return

    if not task.checklist_items:
        task.status = EventTaskStatus.TODO
        task.completed_at = None
        return

    completed_count = sum(1 for item in task.checklist_items if item.is_completed)
    total = len(task.checklist_items)

    if completed_count == 0:
        task.status = EventTaskStatus.TODO
        task.completed_at = None
    elif completed_count == total:
        task.status = EventTaskStatus.DONE
        if task.completed_at is None:
            task.completed_at = datetime.now(UTC)
    else:
        task.status = EventTaskStatus.IN_PROGRESS
        task.completed_at = None
