from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

if TYPE_CHECKING:
    from app.models.preptask import PrepTask, PrepTaskChecklistItem


class PrepTaskCreateRequest(BaseModel):
    group_name: str = Field(min_length=1, max_length=255)
    due_date: datetime
    assignee_id: int | None = None
    checklist_items: list[str] | None = Field(
        default=None,
        max_length=20,
        description=(
            "Optional custom checklist labels; uses group template when omitted"
        ),
    )

    @field_validator("group_name", mode="before")
    @classmethod
    def strip_group_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("checklist_items", mode="before")
    @classmethod
    def strip_checklist_items(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        cleaned: list[str] = []
        for item in value:
            if not isinstance(item, str):
                continue
            label = item.strip()
            if label:
                cleaned.append(label)

        if not cleaned:
            raise ValueError("checklist_items must include at least one task")

        return cleaned

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("due_date must include a timezone")
        return value


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
