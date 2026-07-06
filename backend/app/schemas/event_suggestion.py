from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EventSuggestionMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class EventSuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    preferred_timing: str | None
    status: Literal["submitted", "noted"]
    suggested_by: EventSuggestionMemberResponse
    noted_by: EventSuggestionMemberResponse | None = None
    created_at: datetime
    noted_at: datetime | None = None


class EventSuggestionListResponse(BaseModel):
    suggestions: list[EventSuggestionResponse]
    total: int


class EventSuggestionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    preferred_timing: str | None = Field(default=None, max_length=255)


class EventSuggestionStatusUpdateRequest(BaseModel):
    status: Literal["noted"]
