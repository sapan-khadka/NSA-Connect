from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, model_validator

from app.models.event_task import EventTaskKind
from app.schemas.event_task import (
    ChecklistEventTaskCreateRequest,
    EventTaskChecklistItemResponse,
    EventTaskResponse,
)

if TYPE_CHECKING:
    from app.models.event_task import EventTask


class PrepTaskCreateRequest(ChecklistEventTaskCreateRequest):
    """Backward-compatible alias for checklist task creation."""


class PrepTaskUpdateRequest(BaseModel):
    is_complete: bool | None = None
    assignee_id: int | None = None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "PrepTaskUpdateRequest":
        if self.model_fields_set.isdisjoint({"is_complete", "assignee_id"}):
            raise ValueError("At least one field must be provided")
        return self


class PrepTaskChecklistItemUpdateRequest(BaseModel):
    is_completed: bool


class PrepTaskChecklistItemResponse(EventTaskChecklistItemResponse):
    pass


class PrepTaskResponse(BaseModel):
    id: int
    group_name: str
    due_date: datetime
    assignee_id: int | None
    is_overdue: bool
    is_complete: bool
    checklist_items: list[PrepTaskChecklistItemResponse]

    @classmethod
    def from_event_task(cls, task: "EventTask") -> "PrepTaskResponse":
        if task.task_kind != EventTaskKind.CHECKLIST:
            raise ValueError("Task is not a checklist task")

        return cls(
            id=task.id,
            group_name=task.title,
            due_date=task.due_date,
            assignee_id=task.assignee_id,
            is_overdue=task.is_overdue,
            is_complete=task.is_checklist_complete,
            checklist_items=[
                PrepTaskChecklistItemResponse.from_item(item)
                for item in task.checklist_items
            ],
        )

    @classmethod
    def from_task_response(cls, response: EventTaskResponse) -> "PrepTaskResponse":
        if response.task_kind != EventTaskKind.CHECKLIST:
            raise ValueError("Task is not a checklist task")

        return cls(
            id=response.id,
            group_name=response.group_name or response.title,
            due_date=response.due_date,
            assignee_id=response.assignee_id,
            is_overdue=response.is_overdue,
            is_complete=response.is_complete,
            checklist_items=[
                PrepTaskChecklistItemResponse.model_validate(item.model_dump())
                for item in response.checklist_items
            ],
        )
