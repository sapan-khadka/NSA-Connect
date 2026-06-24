from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from app.models.preptask import PrepTask, PrepTaskChecklistItem


class PrepTaskChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    is_completed: bool
    sort_order: int

    @classmethod
    def from_item(cls, item: "PrepTaskChecklistItem") -> "PrepTaskChecklistItemResponse":
        return cls(
            id=item.id,
            label=item.label,
            is_completed=item.is_completed,
            sort_order=item.sort_order,
        )


class PrepTaskResponse(BaseModel):
    id: int
    group_name: str
    due_date: datetime
    assignee_id: int | None
    is_overdue: bool
    is_complete: bool
    checklist_items: list[PrepTaskChecklistItemResponse]

    @classmethod
    def from_prep_task(cls, prep_task: "PrepTask") -> "PrepTaskResponse":
        return cls(
            id=prep_task.id,
            group_name=prep_task.group.group_name,
            due_date=prep_task.due_date,
            assignee_id=prep_task.assignee_id,
            is_overdue=prep_task.is_overdue,
            is_complete=prep_task.is_complete,
            checklist_items=[
                PrepTaskChecklistItemResponse.from_item(item)
                for item in prep_task.checklist_items
            ],
        )
