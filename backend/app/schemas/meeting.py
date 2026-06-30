from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.meeting import MeetingAttendanceStatus


class MeetingActionItemResponse(BaseModel):
    task: str
    owner: str | None = None
    due: str | None = None


class MeetingMinutesResponse(BaseModel):
    raw_notes: str
    summary: str | None = None
    key_decisions: list[str] = Field(default_factory=list)
    action_items: list[MeetingActionItemResponse] = Field(default_factory=list)
    updated_at: datetime | None = None
    updated_by_name: str | None = None


class MeetingAttendanceEntryResponse(BaseModel):
    member_id: int
    full_name: str
    position: str
    role: str
    status: MeetingAttendanceStatus | None = None


class MeetingDetailResponse(BaseModel):
    event_id: int
    event_name: str
    agenda: str
    starts_at: datetime
    is_past: bool
    can_manage: bool
    minutes: MeetingMinutesResponse
    attendance: list[MeetingAttendanceEntryResponse]
    present_count: int
    absent_count: int
    excused_count: int
    unmarked_count: int


class MeetingSummaryResponse(BaseModel):
    event_id: int
    event_name: str
    starts_at: datetime
    is_past: bool
    agenda: str
    has_attendance: bool
    has_minutes: bool
    has_summary: bool
    present_count: int
    absent_count: int
    excused_count: int
    unmarked_count: int
    minutes_updated_at: datetime | None = None


class MeetingListResponse(BaseModel):
    meetings: list[MeetingSummaryResponse]
    total: int


class MeetingNotesUpdateRequest(BaseModel):
    raw_notes: str = Field(max_length=50000)

    @field_validator("raw_notes", mode="before")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class MeetingAttendanceUpdateItem(BaseModel):
    member_id: int
    status: MeetingAttendanceStatus


class MeetingAttendanceUpdateRequest(BaseModel):
    entries: list[MeetingAttendanceUpdateItem] = Field(min_length=1)
