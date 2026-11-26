from datetime import datetime

from pydantic import BaseModel, Field, field_validator

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
    published_at: datetime | None = None
    draft_summary: str | None = None
    draft_key_decisions: list[str] = Field(default_factory=list)
    draft_action_items: list[MeetingActionItemResponse] = Field(default_factory=list)
    draft_updated_at: datetime | None = None
    draft_updated_by_name: str | None = None
    draft_version: int | None = None


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
    action_item_count: int = 0
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


class MeetingSummarizeRequest(MeetingNotesUpdateRequest):
    confirm_regenerate: bool = False
    base_draft_version: int | None = Field(default=None, ge=1)


class MeetingActionItemWrite(BaseModel):
    task: str = Field(min_length=1, max_length=500)
    owner: str | None = Field(default=None, max_length=255)
    due: str | None = Field(default=None, max_length=255)

    @field_validator("task", "owner", "due", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value or None


class MeetingDraftUpdateRequest(BaseModel):
    summary: str = Field(default="", max_length=10000)
    key_decisions: list[str] = Field(default_factory=list, max_length=30)
    action_items: list[MeetingActionItemWrite] = Field(default_factory=list, max_length=50)
    base_draft_version: int | None = Field(default=None, ge=1)

    @field_validator("summary", mode="before")
    @classmethod
    def strip_summary(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("key_decisions")
    @classmethod
    def strip_decisions(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            text = item.strip() if isinstance(item, str) else ""
            if text:
                if len(text) > 500:
                    raise ValueError("Decision text is too long")
                cleaned.append(text)
        return cleaned


class MeetingPublishRequest(BaseModel):
    base_draft_version: int = Field(ge=1)


class MeetingAttendanceUpdateItem(BaseModel):
    member_id: int
    status: MeetingAttendanceStatus


class MeetingAttendanceUpdateRequest(BaseModel):
    entries: list[MeetingAttendanceUpdateItem] = Field(min_length=1)
