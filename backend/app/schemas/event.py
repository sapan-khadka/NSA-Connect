from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.lib.event_finance import (
    get_event_finance_lock_at,
    is_event_finance_grace_period,
    is_event_finance_locked,
)
from app.models.event import EventType
from app.models.event_rsvp import RsvpStatus

if TYPE_CHECKING:
    from app.models.event import Event

from app.models.event_task import EventTaskKind
from app.schemas.preptask import PrepTaskResponse

MAX_EVENT_BUDGET = Decimal("999999.99")


class EventCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    event_type: EventType
    description: str = Field(min_length=1, max_length=5000)
    budget: Decimal = Field(ge=Decimal("0"), le=MAX_EVENT_BUDGET)

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
    def starts_at_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("starts_at must include a timezone")
        return value

    @field_validator("starts_at")
    @classmethod
    def starts_at_must_be_in_future(cls, value: datetime) -> datetime:
        if value <= datetime.now(value.tzinfo):
            raise ValueError("Event date must be in the future")
        return value

    @field_validator("budget")
    @classmethod
    def budget_must_have_two_decimal_places(cls, value: Decimal) -> Decimal:
        normalized = value.quantize(Decimal("0.01"))
        if normalized != value:
            raise ValueError("Budget must have at most 2 decimal places")
        return normalized


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
    finance_lock_at: datetime
    is_finance_locked: bool
    is_past: bool
    is_finance_grace_period: bool

    @classmethod
    def from_event(
        cls,
        event: "Event",
        *,
        current_member_rsvp_status: RsvpStatus | None = None,
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
            finance_lock_at=get_event_finance_lock_at(event),
            is_finance_locked=is_event_finance_locked(event),
            is_past=not event.is_upcoming,
            is_finance_grace_period=is_event_finance_grace_period(event),
        )


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

    @classmethod
    def from_event(
        cls,
        event: "Event",
        *,
        current_member_rsvp_status: RsvpStatus | None = None,
    ) -> "EventDetailResponse":
        base = EventResponse.from_event(
            event,
            current_member_rsvp_status=current_member_rsvp_status,
        )
        return cls(
            **base.model_dump(),
            prep_tasks=[
                PrepTaskResponse.from_event_task(task)
                for task in event.event_tasks
                if task.task_kind == EventTaskKind.CHECKLIST
            ],
        )
