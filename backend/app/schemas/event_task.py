from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.event_task import EventTaskKind, EventTaskStatus
from app.models.member import MemberPosition

if TYPE_CHECKING:
    from app.models.event_task import EventTask, EventTaskChecklistItem
    from app.models.member import Member


class EventTaskChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    is_completed: bool
    sort_order: int

    @classmethod
    def from_item(
        cls,
        item: "EventTaskChecklistItem",
    ) -> "EventTaskChecklistItemResponse":
        return cls(
            id=item.id,
            label=item.label,
            is_completed=item.is_completed,
            sort_order=item.sort_order,
        )


class EventTaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    assignee_id: int | None = None
    due_date: datetime | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Title must not be empty")
        return value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return value


class ChecklistEventTaskCreateRequest(BaseModel):
    group_name: str = Field(min_length=1, max_length=255)
    due_date: datetime
    assignee_id: int | None = None
    checklist_items: list[str] | None = Field(default=None, max_length=20)

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

        if value and not cleaned:
            raise ValueError("checklist_items must include at least one task")

        return cleaned

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("due_date must include a timezone")
        return value


class EventTaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: int | None = None
    due_date: datetime | None = None
    status: EventTaskStatus | None = None
    is_complete: bool | None = None
    completion_note: str | None = Field(default=None, max_length=5000)
    completion_photo_url: str | None = Field(default=None, max_length=2048)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Title must not be empty")
        return value

    @field_validator("completion_note", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("completion_photo_url", mode="before")
    @classmethod
    def normalize_photo_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        return value or None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "EventTaskUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class EventTaskChecklistItemUpdateRequest(BaseModel):
    is_completed: bool


class EventTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    event_name: str
    task_kind: EventTaskKind
    title: str
    group_name: str | None
    description: str
    assignee_id: int | None
    assignee_name: str | None
    status: EventTaskStatus
    due_date: datetime | None
    is_overdue: bool
    is_complete: bool
    checklist_items: list[EventTaskChecklistItemResponse]
    completion_note: str | None
    completion_photo_url: str | None
    completed_at: datetime | None
    created_by_id: int | None
    created_at: datetime

    @classmethod
    def from_task(cls, task: "EventTask") -> "EventTaskResponse":
        return cls(
            id=task.id,
            event_id=task.event_id,
            event_name=task.event.title if task.event else "",
            task_kind=task.task_kind,
            title=task.title,
            group_name=task.title if task.task_kind == EventTaskKind.CHECKLIST else None,
            description=task.description,
            assignee_id=task.assignee_id,
            assignee_name=task.assignee.full_name if task.assignee else None,
            status=task.status,
            due_date=task.due_date,
            is_overdue=task.is_overdue,
            is_complete=task.is_checklist_complete,
            checklist_items=[
                EventTaskChecklistItemResponse.from_item(item)
                for item in task.checklist_items
            ],
            completion_note=task.completion_note,
            completion_photo_url=task.completion_photo_url,
            completed_at=task.completed_at,
            created_by_id=task.created_by_id,
            created_at=task.created_at,
        )


class EventTaskListResponse(BaseModel):
    tasks: list[EventTaskResponse]
    total: int


class TaskOverviewMember(BaseModel):
    member_id: int
    full_name: str
    role: str
    position: MemberPosition
    total: int
    completed: int
    in_progress: int
    todo: int
    completion_percent: int
    tasks: list[EventTaskResponse]

    @classmethod
    def build(
        cls,
        member: "Member",
        tasks: list["EventTask"],
    ) -> "TaskOverviewMember":
        completed = sum(1 for task in tasks if task.status == EventTaskStatus.DONE)
        in_progress = sum(
            1 for task in tasks if task.status == EventTaskStatus.IN_PROGRESS
        )
        todo = sum(1 for task in tasks if task.status == EventTaskStatus.TODO)
        total = len(tasks)
        percent = round((completed / total) * 100) if total else 0
        return cls(
            member_id=member.id,
            full_name=member.full_name,
            role=member.role.value,
            position=member.position or MemberPosition.MEMBER,
            total=total,
            completed=completed,
            in_progress=in_progress,
            todo=todo,
            completion_percent=percent,
            tasks=[EventTaskResponse.from_task(task) for task in tasks],
        )


class TaskOverviewResponse(BaseModel):
    members: list[TaskOverviewMember]
    total_tasks: int
    completed_tasks: int


class TaskPhotoUploadResponse(BaseModel):
    photo_url: str
