from datetime import datetime

from pydantic import BaseModel, Field, field_serializer


class PersonalNoteCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)
    event_id: int | None = None
    pinned: bool = False


class PersonalNoteUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=10000)
    event_id: int | None = None
    pinned: bool | None = None
    clear_event: bool = False


class PersonalNoteResponse(BaseModel):
    id: int
    title: str | None
    content: str
    event_id: int | None
    event_name: str | None
    event_starts_at: datetime | None
    pinned: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at", "event_starts_at")
    def serialize_datetimes(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return value.isoformat()


class PersonalNoteListResponse(BaseModel):
    notes: list[PersonalNoteResponse]
    total: int
