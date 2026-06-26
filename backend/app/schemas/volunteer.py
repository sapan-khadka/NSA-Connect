from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.volunteer import VolunteerSlot


class VolunteerSlotCreateRequest(BaseModel):
    task_name: str = Field(min_length=1, max_length=255)
    max_signup_count: int = Field(ge=1)

    @field_validator("task_name", mode="before")
    @classmethod
    def strip_task_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value


class VolunteerSlotResponse(BaseModel):
    id: int
    event_id: int
    task_name: str
    max_signup_count: int
    signup_count: int
    spots_remaining: int
    is_full: bool
    created_at: datetime

    @classmethod
    def from_slot(cls, slot: "VolunteerSlot") -> "VolunteerSlotResponse":
        return cls(
            id=slot.id,
            event_id=slot.event_id,
            task_name=slot.title,
            max_signup_count=slot.capacity,
            signup_count=slot.signup_count,
            spots_remaining=slot.spots_remaining,
            is_full=slot.is_full,
            created_at=slot.created_at,
        )
