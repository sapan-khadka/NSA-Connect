from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.event import EventType

if TYPE_CHECKING:
    from app.models.event import Event

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
    event_type: EventType
    description: str
    budget: Decimal
    created_by_id: int

    @classmethod
    def from_event(cls, event: "Event") -> "EventResponse":
        return cls(
            id=event.id,
            name=event.title,
            starts_at=event.starts_at,
            event_type=event.event_type,
            description=event.description,
            budget=Decimal(event.budget),
            created_by_id=event.created_by_id,
        )


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int
