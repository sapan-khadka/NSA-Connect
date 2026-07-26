from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.lib.event_dates import validate_starts_at_not_before_today
from app.models.event import EventType, MeetingVisibility
from app.schemas.event import MAX_EVENT_BUDGET

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
    board_note: str | None = None
    can_board_review: bool = False
    converted_event_id: int | None = None
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


class EventSuggestionBoardReviewRequest(BaseModel):
    """Board-only review update. Provide status and/or board_note."""

    status: BoardUpdatableStatusValue | None = None
    board_note: str | None = Field(default=None, max_length=2000)


class EventSuggestionConvertRequest(BaseModel):
    """Board converts an approved idea into a live event."""

    name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    starts_at: datetime
    event_type: EventType
    location: str | None = Field(default=None, max_length=255)
    capacity: int | None = Field(default=None, ge=1)
    budget: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0"),
        le=MAX_EVENT_BUDGET,
    )
    meeting_visibility: MeetingVisibility | None = None

    @field_validator("name", "description", "location", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        return value or None

    @field_validator("starts_at")
    @classmethod
    def starts_at_must_not_be_before_today(cls, value: datetime) -> datetime:
        return validate_starts_at_not_before_today(value)

    @field_validator("budget")
    @classmethod
    def budget_must_have_two_decimal_places(cls, value: Decimal) -> Decimal:
        normalized = value.quantize(Decimal("0.01"))
        if normalized != value:
            raise ValueError("Budget must have at most 2 decimal places")
        return normalized

    @model_validator(mode="after")
    def default_meeting_visibility(self) -> "EventSuggestionConvertRequest":
        if self.event_type == EventType.MEETING and self.meeting_visibility is None:
            self.meeting_visibility = MeetingVisibility.BOARD_ONLY
        return self


class EventSuggestionInterestUpdateRequest(BaseModel):
    vote: EventSuggestionInterestVoteValue


class EventSuggestionCommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: int | None = None


class EventSuggestionCommentResponse(BaseModel):
    id: int
    suggestion_id: int
    parent_id: int | None
    content: str
    author: EventSuggestionMemberResponse
    created_at: datetime
    deleted_at: datetime | None = None
    is_deleted: bool = False
    can_delete: bool = False
    replies: list["EventSuggestionCommentResponse"] = Field(default_factory=list)


class EventSuggestionCommentListResponse(BaseModel):
    comments: list[EventSuggestionCommentResponse]
    total: int
