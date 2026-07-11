from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.lib.event_dates import validate_starts_at_not_before_today
from app.lib.event_finance import (
    get_event_finance_lock_at,
    is_event_finance_grace_period,
    is_event_finance_locked,
)
from app.models.event import EventType, MeetingVisibility
from app.models.event_rsvp import RsvpStatus

if TYPE_CHECKING:
    from app.models.event import Event

from app.models.event_task import EventTaskKind
from app.schemas.event_feedback import EventFeedbackResponse
from app.schemas.event_volunteer_signup import EventVolunteerSignupResponse
from app.schemas.preptask import PrepTaskResponse

MAX_EVENT_BUDGET = Decimal("999999.99")


class EventCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    event_type: EventType
    description: str = Field(min_length=1, max_length=5000)
    budget: Decimal = Field(ge=Decimal("0"), le=MAX_EVENT_BUDGET)
    meeting_visibility: MeetingVisibility | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

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
    def default_meeting_visibility(self) -> "EventCreateRequest":
        if self.event_type == EventType.MEETING and self.meeting_visibility is None:
            self.meeting_visibility = MeetingVisibility.BOARD_ONLY
        return self


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    starts_at: datetime
    ends_at: datetime | None = None
    event_type: EventType
    description: str
    location: str | None = None
    budget: Decimal
    created_by_id: int
    current_member_rsvp_status: RsvpStatus | None = None
    current_member_is_invited_participant: bool = False
    finance_lock_at: datetime
    is_finance_locked: bool
    is_past: bool
    is_finance_grace_period: bool
    show_in_photo_archive: bool
    meeting_visibility: MeetingVisibility | None = None
    event_photo_url: str | None = None

    @classmethod
    def from_event(
        cls,
        event: "Event",
        *,
        current_member_rsvp_status: RsvpStatus | None = None,
        current_member_is_invited_participant: bool = False,
    ) -> "EventResponse":
        return cls(
            id=event.id,
            name=event.title,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            event_type=event.event_type,
            description=event.description,
            location=event.location,
            budget=Decimal(event.budget),
            created_by_id=event.created_by_id,
            current_member_rsvp_status=current_member_rsvp_status,
            current_member_is_invited_participant=current_member_is_invited_participant,
            finance_lock_at=get_event_finance_lock_at(event),
            is_finance_locked=is_event_finance_locked(event),
            is_past=not event.is_upcoming,
            is_finance_grace_period=is_event_finance_grace_period(event),
            show_in_photo_archive=event.show_in_photo_archive,
            meeting_visibility=event.meeting_visibility,
            event_photo_url=event.event_photo_url,
        )


class EventPatchRequest(BaseModel):
    show_in_photo_archive: bool | None = None
    starts_at: datetime | None = None
    meeting_visibility: MeetingVisibility | None = None

    @field_validator("starts_at")
    @classmethod
    def starts_at_must_not_be_before_today(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None
        return validate_starts_at_not_before_today(value)

    @model_validator(mode="after")
    def at_least_one_field(self) -> "EventPatchRequest":
        if (
            self.show_in_photo_archive is None
            and self.starts_at is None
            and self.meeting_visibility is None
        ):
            raise ValueError("At least one field must be provided")
        return self


class EventRsvpUpdateRequest(BaseModel):
    status: RsvpStatus


class EventRsvpStatusResponse(BaseModel):
    event_id: int
    current_member_rsvp_status: RsvpStatus | None


class EventRsvpAttendeeResponse(BaseModel):
    member_id: int
    full_name: str
    member_type: str
    rsvp_status: RsvpStatus | None


class EventAttendeesResponse(BaseModel):
    going_count: int
    maybe_count: int
    not_going_count: int
    no_response_count: int
    attendees: list[EventRsvpAttendeeResponse]


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int


class EventDetailResponse(EventResponse):
    prep_tasks: list[PrepTaskResponse]
    current_member_volunteer_signup: EventVolunteerSignupResponse | None = None
    current_member_feedback: EventFeedbackResponse | None = None

    @classmethod
    def from_event(
        cls,
        event: "Event",
        *,
        current_member_rsvp_status: RsvpStatus | None = None,
        current_member_is_invited_participant: bool = False,
        current_member_volunteer_signup: EventVolunteerSignupResponse | None = None,
        current_member_feedback: EventFeedbackResponse | None = None,
    ) -> "EventDetailResponse":
        base = EventResponse.from_event(
            event,
            current_member_rsvp_status=current_member_rsvp_status,
            current_member_is_invited_participant=current_member_is_invited_participant,
        )
        return cls(
            **base.model_dump(),
            prep_tasks=[
                PrepTaskResponse.from_event_task(task)
                for task in event.event_tasks
                if task.task_kind == EventTaskKind.CHECKLIST
            ],
            current_member_volunteer_signup=current_member_volunteer_signup,
            current_member_feedback=current_member_feedback,
        )
