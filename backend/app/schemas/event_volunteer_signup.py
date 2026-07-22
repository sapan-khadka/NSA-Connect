from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.event_volunteer_signup import EventVolunteerSignupStatus


class EventVolunteerSignupCreateRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        return trimmed or None


class EventVolunteerSignupReviewRequest(BaseModel):
    status: Literal["approved", "rejected"]


class EventVolunteerSignupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    note: str | None
    status: EventVolunteerSignupStatus
    created_at: datetime
    reviewed_at: datetime | None = None


class EventVolunteerSignupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    full_name: str
    note: str | None
    status: EventVolunteerSignupStatus
    created_at: datetime
    reviewed_at: datetime | None = None


class EventVolunteerSignupListResponse(BaseModel):
    signups: list[EventVolunteerSignupMemberResponse]
    total: int
