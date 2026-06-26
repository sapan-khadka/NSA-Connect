from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.volunteer import VolunteerSignup, VolunteerSlot


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


class VolunteerSignupResponse(BaseModel):
    id: int
    slot_id: int
    member_id: int
    created_at: datetime
    task_name: str
    max_signup_count: int
    signup_count: int
    spots_remaining: int
    is_full: bool

    @classmethod
    def from_signup(
        cls,
        signup: "VolunteerSignup",
        slot: "VolunteerSlot",
    ) -> "VolunteerSignupResponse":
        return cls(
            id=signup.id,
            slot_id=signup.slot_id,
            member_id=signup.member_id,
            created_at=signup.created_at,
            task_name=slot.title,
            max_signup_count=slot.capacity,
            signup_count=slot.signup_count,
            spots_remaining=slot.spots_remaining,
            is_full=slot.is_full,
        )
