from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.discussion_message import MAX_DISCUSSION_CONTENT_LENGTH


class DiscussionMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_DISCUSSION_CONTENT_LENGTH)

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DiscussionReactionRequest(BaseModel):
    type: Literal["reaction"] = "reaction"
    message_id: int = Field(ge=1)
    emoji: str = Field(min_length=1, max_length=16)
    action: Literal["add", "remove"]

    @field_validator("emoji", mode="before")
    @classmethod
    def normalize_emoji(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DiscussionReadReceiptRequest(BaseModel):
    type: Literal["read_receipt"] = "read_receipt"
    last_read_message_id: int = Field(ge=1)


class DiscussionReadReceiptResponse(BaseModel):
    user_id: int
    room_id: str
    last_read_message_id: int
    full_name: str
    initials: str


class DiscussionMessageAuthor(BaseModel):
    id: int
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class DiscussionReactionSummary(BaseModel):
    count: int = Field(ge=0)
    reacted_by_me: bool = False


class DiscussionMessageResponse(BaseModel):
    id: int
    content: str
    event_id: int | None
    custom_room_id: int | None = None
    created_at: datetime
    author: DiscussionMessageAuthor
    reactions: dict[str, DiscussionReactionSummary] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DiscussionMessageListResponse(BaseModel):
    messages: list[DiscussionMessageResponse]
    total: int


class DiscussionRoomIdRequest(BaseModel):
    room_id: str = Field(min_length=1, max_length=64)

    @field_validator("room_id", mode="before")
    @classmethod
    def normalize_room_id(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DiscussionRoomReadResponse(BaseModel):
    room_id: str
    last_read_at: datetime


class DiscussionPinToggleResponse(BaseModel):
    room_id: str
    pinned: bool


class DiscussionInboxRoomResponse(BaseModel):
    room_id: str
    label: str
    event_id: int | None = None
    event_type: str | None = None
    href: str
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    last_message_author: str | None = None
    unread_count: int = 0
    unread_display: str | None = None
    pinned: bool = False
    pinned_at: datetime | None = None


class DiscussionInboxResponse(BaseModel):
    rooms: list[DiscussionInboxRoomResponse]
