"""Member engagement — activity-based active vs idle (not membership approval)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import StrEnum

from pydantic import BaseModel, Field


class MemberEngagementStatus(StrEnum):
    ACTIVE = "active"
    IDLE = "idle"


class MemberEngagementSignals(BaseModel):
    attended_event: bool = False
    paid_dues: bool = False
    completed_task: bool = False
    in_progress_task: bool = False
    shared_suggestion: bool = False


class MemberEngagementEntry(BaseModel):
    member_id: int
    status: MemberEngagementStatus
    signals: MemberEngagementSignals


class MembersEngagementResponse(BaseModel):
    semester: str
    window_days: int = Field(ge=1)
    active_count: int = Field(ge=0)
    idle_count: int = Field(ge=0)
    members: list[MemberEngagementEntry]
