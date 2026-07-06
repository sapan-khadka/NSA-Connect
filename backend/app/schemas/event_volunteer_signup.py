from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class EventVolunteerSignupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    note: str | None
    created_at: datetime


class EventVolunteerSignupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    full_name: str
    note: str | None
    created_at: datetime


class EventVolunteerSignupListResponse(BaseModel):
    signups: list[EventVolunteerSignupMemberResponse]
    total: int
