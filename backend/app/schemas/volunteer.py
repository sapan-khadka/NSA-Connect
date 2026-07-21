from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.volunteer import VolunteerSignup, VolunteerSlot


class VolunteerSlotCreateRequest(BaseModel):
    task_name: str = Field(min_length=1, max_length=255)
    max_signup_count: int = Field(ge=1)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("task_name", mode="before")
    @classmethod
    def strip_task_name(cls, value: str) -> str:
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        return value or None


class VolunteerSlotPatchRequest(BaseModel):
    task_name: str | None = Field(default=None, min_length=1, max_length=255)
    max_signup_count: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("task_name", mode="before")
    @classmethod
    def strip_task_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        if not value:
            raise ValueError("Must not be empty")
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        return value or None

    def has_updates(self) -> bool:
        return any(
            value is not None
            for value in (self.task_name, self.max_signup_count, self.description)
        ) or "description" in self.model_fields_set


class VolunteerSlotFiller(BaseModel):
    member_id: int
    full_name: str


class VolunteerSlotResponse(BaseModel):
    id: int
    event_id: int
    task_name: str
    description: str = ""
    max_signup_count: int
    signup_count: int
    spots_remaining: int
    is_full: bool
    created_at: datetime
    current_member_signed_up: bool = False
    filled_by: list[VolunteerSlotFiller] = []

    @classmethod
    def from_slot(
        cls,
        slot: "VolunteerSlot",
        *,
        member_id: int | None = None,
        include_roster: bool = False,
    ) -> "VolunteerSlotResponse":
        signed_up = False
        if member_id is not None:
            signed_up = any(signup.member_id == member_id for signup in slot.signups)

        filled_by: list[VolunteerSlotFiller] = []
        if include_roster:
            filled_by = [
                VolunteerSlotFiller(
                    member_id=signup.member_id,
                    full_name=(
                        signup.member.full_name
                        if signup.member is not None
                        else f"Member {signup.member_id}"
                    ),
                )
                for signup in slot.signups
            ]

        return cls(
            id=slot.id,
            event_id=slot.event_id,
            task_name=slot.title,
            description=slot.description or "",
            max_signup_count=slot.capacity,
            signup_count=slot.signup_count,
            spots_remaining=slot.spots_remaining,
            is_full=slot.is_full,
            created_at=slot.created_at,
            current_member_signed_up=signed_up,
            filled_by=filled_by,
        )


class VolunteerSlotListResponse(BaseModel):
    slots: list[VolunteerSlotResponse]
    total: int


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


class MemberVolunteerSignupResponse(BaseModel):
    id: int
    slot_id: int
    task_name: str
    event_id: int
    event_name: str
    event_starts_at: datetime
    signed_up_at: datetime
    is_done: bool


class MemberVolunteerSignupListResponse(BaseModel):
    signups: list[MemberVolunteerSignupResponse]
    total: int
