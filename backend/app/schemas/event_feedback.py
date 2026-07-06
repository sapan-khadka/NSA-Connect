from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventFeedbackCreateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=5000)

    @field_validator("comment", mode="before")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        return trimmed or None


class EventFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    rating: int
    comment: str | None
    created_at: datetime


class EventFeedbackMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    full_name: str
    rating: int
    comment: str | None
    created_at: datetime


class EventFeedbackListResponse(BaseModel):
    feedback: list[EventFeedbackMemberResponse]
    total: int
    average_rating: float
