from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict

from app.models.event import EventType

if TYPE_CHECKING:
    from app.models.event import Event


class PublicEventResponse(BaseModel):
    """Sanitized event payload for unauthenticated visitors."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    starts_at: datetime
    ends_at: datetime | None = None
    event_type: EventType
    description: str
    location: str | None = None
    capacity: int | None = None
    going_count: int = 0
    event_photo_url: str | None = None
    is_past: bool

    @classmethod
    def from_event(
        cls,
        event: "Event",
        *,
        going_count: int = 0,
    ) -> "PublicEventResponse":
        return cls(
            id=event.id,
            name=event.title,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            event_type=event.event_type,
            description=event.description,
            location=event.location,
            capacity=event.capacity,
            going_count=going_count,
            event_photo_url=event.event_photo_url,
            is_past=not event.is_upcoming,
        )
