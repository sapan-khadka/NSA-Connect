from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.models.preptask import PrepTask, PrepTaskChecklistItem


class PrepTaskCreateRequest(BaseModel):
    group_name: str = Field(min_length=1, max_length=255)
    due_date: datetime
    assignee_id: int | None = None

    @field_validator("group_name", mode="before")
    @classmethod
    def strip_group_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("due_date must include a timezone")
        return value


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
