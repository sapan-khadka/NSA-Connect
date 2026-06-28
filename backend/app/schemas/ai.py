from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.event import EventType


class GenerateChecklistRequest(BaseModel):
    event_name: str = Field(min_length=1, max_length=255)
    event_type: EventType
    tasks: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("event_name", mode="before")
    @classmethod
    def strip_event_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("tasks", mode="before")
    @classmethod
    def strip_task_labels(cls, value: list[str]) -> list[str]:
        if not isinstance(value, list):
            return value

        cleaned: list[str] = []
        for item in value:
            if not isinstance(item, str):
                continue
            label = item.strip()
            if label:
                cleaned.append(label)
        return cleaned


class ChecklistCategoryResponse(BaseModel):
    category: str
    tasks: list[str]


class GenerateChecklistResponse(BaseModel):
    categories: list[ChecklistCategoryResponse]


class DraftAnnouncementEmailRequest(BaseModel):
    event_name: str = Field(min_length=1, max_length=255)
    event_type: EventType | None = None
    starts_at: datetime | None = None
    location: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("event_name", mode="before")
    @classmethod
    def strip_event_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("location", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str):
            return value
        value = value.strip()
        return value or None

    @field_validator("starts_at")
    @classmethod
    def starts_at_must_be_timezone_aware(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return value
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("starts_at must include a timezone")
        return value


class DraftAnnouncementEmailResponse(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=10000)


class SummarizeMinutesRequest(BaseModel):
    notes: str = Field(min_length=1, max_length=20000)
    meeting_title: str | None = Field(default=None, max_length=255)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("meeting_title", mode="before")
    @classmethod
    def strip_meeting_title(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str):
            return value
        value = value.strip()
        return value or None


class MeetingActionItemResponse(BaseModel):
    task: str = Field(min_length=1, max_length=500)
    owner: str | None = Field(default=None, max_length=255)
    due: str | None = Field(default=None, max_length=255)


class SummarizeMinutesResponse(BaseModel):
    summary: str = Field(min_length=1, max_length=10000)
    key_decisions: list[str] = Field(default_factory=list, max_length=30)
    action_items: list[MeetingActionItemResponse] = Field(
        default_factory=list,
        max_length=50,
    )


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=20)

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value


class ChatConstitutionSource(BaseModel):
    chunk_id: int = Field(ge=1)
    section: str | None = None
    chunk_index: int = Field(ge=0)
    similarity_score: float = Field(ge=0.0, le=1.0)
    excerpt: str = Field(min_length=1)


class ChatToolCallRecord(BaseModel):
    tool_name: str
    input: dict
    output: str


class ChatResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=10000)
    constitution_sources: list[ChatConstitutionSource] = Field(default_factory=list)
    tool_calls: list[ChatToolCallRecord] = Field(default_factory=list)
