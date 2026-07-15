from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MemberNoteCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)
    pinned: bool = False


class MemberNoteUpdateRequest(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=10_000)
    pinned: bool | None = None


class MemberNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    author_id: int
    author_name: str
    content: str
    pinned: bool
    created_at: datetime
    updated_at: datetime


class MemberNoteListResponse(BaseModel):
    member_id: int
    notes: list[MemberNoteResponse]
    total: int
