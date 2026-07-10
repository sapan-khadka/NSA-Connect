from datetime import datetime

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


class DiscussionMessageAuthor(BaseModel):
    id: int
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class DiscussionMessageResponse(BaseModel):
    id: int
    content: str
    event_id: int | None
    created_at: datetime
    author: DiscussionMessageAuthor

    model_config = ConfigDict(from_attributes=True)


class DiscussionMessageListResponse(BaseModel):
    messages: list[DiscussionMessageResponse]
    total: int
