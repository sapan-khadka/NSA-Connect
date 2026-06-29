from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.event_task import EventTaskStatus
from app.models.member import MemberPosition

if TYPE_CHECKING:
    from app.models.event_task import EventTask
    from app.models.member import Member


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


class EventTaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: int | None = None
    due_date: datetime | None = None
    status: EventTaskStatus | None = None
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


class EventTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    event_name: str
    title: str
    description: str
    assignee_id: int | None
    assignee_name: str | None
    status: EventTaskStatus
    due_date: datetime | None
    completion_note: str | None
    completion_photo_url: str | None
    completed_at: datetime | None
    created_by_id: int
    created_at: datetime

    @classmethod
    def from_task(cls, task: "EventTask") -> "EventTaskResponse":
        return cls(
            id=task.id,
            event_id=task.event_id,
            event_name=task.event.title if task.event else "",
            title=task.title,
            description=task.description,
            assignee_id=task.assignee_id,
            assignee_name=task.assignee.full_name if task.assignee else None,
            status=task.status,
            due_date=task.due_date,
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
