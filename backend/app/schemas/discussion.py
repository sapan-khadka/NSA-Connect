from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.discussion_message import MAX_DISCUSSION_CONTENT_LENGTH
from app.services.discussion_attachment_upload_service import (
    MAX_ATTACHMENTS_PER_MESSAGE,
)


class DiscussionAttachmentPayload(BaseModel):
    """Pre-uploaded attachment metadata sent with a new chat message."""

    url: str = Field(min_length=1, max_length=2048)
    public_id: str | None = Field(default=None, max_length=512)
    file_name: str = Field(min_length=1, max_length=512)
    content_type: str = Field(min_length=1, max_length=128)
    size_bytes: int = Field(ge=1)
    kind: Literal["image", "video", "file", "audio"]
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    duration_ms: int | None = Field(default=None, ge=0)

    @field_validator("url", "file_name", "content_type", "public_id", mode="before")
    @classmethod
    def strip_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DiscussionAttachmentResponse(BaseModel):
    id: int
    kind: Literal["image", "video", "file", "audio"]
    file_name: str
    content_type: str
    size_bytes: int
    url: str
    public_id: str | None = None
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiscussionAttachmentUploadResponse(BaseModel):
    url: str
    public_id: str
    file_name: str
    content_type: str
    size_bytes: int
    kind: Literal["image", "video", "file", "audio"]
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None


class DiscussionSharedFileResponse(BaseModel):
    """Attachment row for the room Shared Files panel."""

    id: int
    kind: Literal["image", "video", "file", "audio"]
    file_name: str
    content_type: str
    size_bytes: int
    url: str
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    created_at: datetime
    message_id: int
    author_id: int
    author_name: str


class DiscussionSharedFileListResponse(BaseModel):
    files: list[DiscussionSharedFileResponse]
    total: int


class DiscussionMessageCreateRequest(BaseModel):
    content: str = Field(default="", max_length=MAX_DISCUSSION_CONTENT_LENGTH)
    reply_to_message_id: int | None = Field(default=None, ge=1)
    attachments: list[DiscussionAttachmentPayload] = Field(
        default_factory=list,
        max_length=MAX_ATTACHMENTS_PER_MESSAGE,
    )

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value: object) -> object:
        if value is None:
            return ""
        if isinstance(value, str):
            cleaned = "".join(
                ch
                for ch in value
                if ch in "\t\n\r" or (ord(ch) >= 32 and ch != "\x7f")
            )
            return cleaned.strip()
        return value

    @model_validator(mode="after")
    def require_content_or_attachments(self) -> "DiscussionMessageCreateRequest":
        if not self.content and not self.attachments:
            raise ValueError("Message must include content or attachments")
        return self


class DiscussionMessageUpdateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_DISCUSSION_CONTENT_LENGTH)

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = "".join(
                ch
                for ch in value
                if ch in "\t\n\r" or (ord(ch) >= 32 and ch != "\x7f")
            )
            return cleaned.strip()
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


class DiscussionReplyPreview(BaseModel):
    id: int
    author_name: str
    content: str
    is_deleted: bool = False


class DiscussionReactionSummary(BaseModel):
    count: int = Field(ge=0)
    reacted_by_me: bool = False


class DiscussionMessageResponse(BaseModel):
    id: int
    content: str
    event_id: int | None
    custom_room_id: int | None = None
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    is_deleted: bool = False
    author: DiscussionMessageAuthor
    reactions: dict[str, DiscussionReactionSummary] = Field(default_factory=dict)
    reply_to_message_id: int | None = None
    reply_to: DiscussionReplyPreview | None = None
    attachments: list[DiscussionAttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DiscussionPinnedMessageResponse(BaseModel):
    message: DiscussionMessageResponse
    pinned_at: datetime
    pinned_by_name: str


class DiscussionMessageListResponse(BaseModel):
    messages: list[DiscussionMessageResponse]
    total: int
    pinned: DiscussionPinnedMessageResponse | None = None
    has_more: bool = False


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


class DiscussionMuteToggleResponse(BaseModel):
    room_id: str
    muted: bool


class DiscussionWsTicketResponse(BaseModel):
    token: str
    expires_at: datetime


class DiscussionPresenceResponse(BaseModel):
    online: dict[str, bool] = Field(default_factory=dict)


class DiscussionArchiveResponse(BaseModel):
    room_id: str
    archived: bool


class DiscussionArchivedRoomResponse(BaseModel):
    room_id: str
    label: str
    href: str
    kind: Literal["board", "event", "room"]
    archived_at: datetime | None = None


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
    # True when an unread message @mentions this member (home attention queue).
    mentions_you: bool = False
    # Best unread snippet for the home card (prefers mentions over "ok"/"👍").
    attention_preview: str | None = None
    attention_author: str | None = None
    pinned: bool = False
    pinned_at: datetime | None = None
    muted: bool = False
    peer_user_id: int | None = None
    peer_avatar_url: str | None = None
    peer_online: bool | None = None
    avatar_url: str | None = None


class DiscussionInboxResponse(BaseModel):
    rooms: list[DiscussionInboxRoomResponse]
    # Pres/VP only — archived rooms available for restore.
    archived_rooms: list[DiscussionArchivedRoomResponse] = Field(default_factory=list)
