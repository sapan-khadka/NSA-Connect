from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EventSuggestionStatusValue = Literal[
    "pending_review",
    "under_discussion",
    "approved",
    "rejected",
    "converted",
    "archived",
]

BoardUpdatableStatusValue = Literal[
    "under_discussion",
    "approved",
    "rejected",
    "archived",
]

EventSuggestionInterestVoteValue = Literal[
    "interested",
    "maybe",
    "not_interested",
]


class EventSuggestionMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class EventSuggestionInterestCounts(BaseModel):
    interested: int = Field(ge=0, default=0)
    maybe: int = Field(ge=0, default=0)
    not_interested: int = Field(ge=0, default=0)


class EventSuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    preferred_timing: str | None
    status: EventSuggestionStatusValue
    suggested_by: EventSuggestionMemberResponse
    noted_by: EventSuggestionMemberResponse | None = None
    created_at: datetime
    noted_at: datetime | None = None
    interest_counts: EventSuggestionInterestCounts = Field(
        default_factory=EventSuggestionInterestCounts
    )
    my_interest: EventSuggestionInterestVoteValue | None = None


class EventSuggestionListResponse(BaseModel):
    suggestions: list[EventSuggestionResponse]
    total: int


class EventSuggestionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    preferred_timing: str | None = Field(default=None, max_length=255)


class EventSuggestionStatusUpdateRequest(BaseModel):
    status: BoardUpdatableStatusValue


class EventSuggestionInterestUpdateRequest(BaseModel):
    vote: EventSuggestionInterestVoteValue
