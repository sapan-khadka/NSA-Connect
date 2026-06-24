from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class PrepTaskGroup(Base):
    """Catalog of prep groups; group_name drives available checklist selections."""

    __tablename__ = "prep_task_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(255), nullable=False, unique=True)
    items = relationship(
        "PrepTaskGroupItem",
        back_populates="group",
        order_by="PrepTaskGroupItem.sort_order",
        cascade="all, delete-orphan",
    )


class PrepTaskGroupItem(Base):
    """Template checklist row for a group — selecting group_name seeds these items."""

    __tablename__ = "prep_task_group_items"
    __table_args__ = (
        UniqueConstraint("group_id", "sort_order", name="uq_prep_task_group_items_order"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("prep_task_groups.id"), nullable=False)
    label = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    group = relationship("PrepTaskGroup", back_populates="items")


class PrepTask(Base):
    __tablename__ = "prep_tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("prep_task_groups.id"), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    assignee_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    checklist_items = relationship(
        "PrepTaskChecklistItem",
        back_populates="prep_task",
        order_by="PrepTaskChecklistItem.sort_order",
        cascade="all, delete-orphan",
    )
    group = relationship("PrepTaskGroup")

    @property
    def is_overdue(self) -> bool:
        return self.due_date < datetime.now(self.due_date.tzinfo)

    @property
    def is_complete(self) -> bool:
        if not self.checklist_items:
            return False
        return all(item.is_completed for item in self.checklist_items)


class PrepTaskChecklistItem(Base):
    __tablename__ = "prep_task_checklist_items"
    __table_args__ = (
        UniqueConstraint("prep_task_id", "sort_order", name="uq_prep_task_checklist_order"),
    )

    id = Column(Integer, primary_key=True, index=True)
    prep_task_id = Column(Integer, ForeignKey("prep_tasks.id"), nullable=False)
    label = Column(String(255), nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    prep_task = relationship("PrepTask", back_populates="checklist_items")


def checklist_items_from_group(group: PrepTaskGroup) -> list[PrepTaskChecklistItem]:
    """Build checklist rows from a group's template selections."""
    return [
        PrepTaskChecklistItem(label=item.label, sort_order=item.sort_order)
        for item in group.items
    ]
