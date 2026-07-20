from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.discussion_room import (
    MAX_DISCUSSION_ROOM_NAME_LENGTH,
    DiscussionRoomMemberRole,
    DiscussionRoomStatus,
)


class DiscussionRoomCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_DISCUSSION_ROOM_NAME_LENGTH)
    description: str | None = Field(default=None, max_length=500)
    member_ids: list[int] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if isinstance(value, str):
            return " ".join(value.split())
        return value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value


class DiscussionRoomRejectRequest(BaseModel):
    review_note: str | None = Field(default=None, max_length=500)

    @field_validator("review_note", mode="before")
    @classmethod
    def normalize_note(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value


class DiscussionRoomMemberResponse(BaseModel):
    member_id: int
    full_name: str
    role: DiscussionRoomMemberRole

    model_config = ConfigDict(from_attributes=True)


class DiscussionRoomResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: DiscussionRoomStatus
    room_id: str
    href: str
    created_by_id: int
    created_by_name: str
    reviewed_by_id: int | None = None
    reviewed_by_name: str | None = None
    review_note: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    members: list[DiscussionRoomMemberResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DiscussionRoomListResponse(BaseModel):
    rooms: list[DiscussionRoomResponse]
    total: int
