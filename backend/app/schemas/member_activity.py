"""Schemas for member-scoped recent activity."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class MemberActivityType(StrEnum):
    TASK_COMPLETED = "task_completed"
    DUES_PAID = "dues_paid"
    EVENT_CHECKIN = "event_checkin"


class MemberActivityItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: MemberActivityType
    description: str
    timestamp: datetime
    task_id: int | None = None
    event_id: int | None = None
    dues_record_id: int | None = None


class MemberActivityListResponse(BaseModel):
    items: list[MemberActivityItemResponse]
    total: int
