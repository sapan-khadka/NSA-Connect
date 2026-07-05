from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EventCheckInQrResponse(BaseModel):
    event_id: int
    event_name: str
    checkin_url: str
    token: str


class EventCheckInRecordResponse(BaseModel):
    kind: Literal["member", "guest"]
    member_id: int | None = None
    guest_id: int | None = None
    full_name: str
    email: str | None = None
    affiliation_type: str | None = None
    related_member_name: str | None = None
    checked_in_at: datetime


class EventCheckInListResponse(BaseModel):
    checkins: list[EventCheckInRecordResponse]
    total: int


class EventCheckInRequest(BaseModel):
    token: str


class EventGuestCheckInRequest(BaseModel):
    token: str
    guest_name: str = Field(min_length=1, max_length=255)
    affiliation_type: Literal["guest_of_member", "faculty_staff"] | None = None
    related_member_name: str | None = Field(default=None, max_length=255)


class EventCheckInResultResponse(BaseModel):
    status: str
    event_id: int
    event_name: str
    checked_in_at: datetime | None = None
    message: str


class EventGuestCheckInResultResponse(BaseModel):
    status: Literal["checked_in"]
    event_id: int
    event_name: str
    guest_name: str
    checked_in_at: datetime
    message: str


class AttendanceSummaryMemberResponse(BaseModel):
    member_id: int
    full_name: str
    checked_in_at: datetime | None = None


class AttendanceSummaryCategoryResponse(BaseModel):
    count: int
    members: list[AttendanceSummaryMemberResponse]


class GuestAttendanceSummaryResponse(BaseModel):
    count: int


class EventAttendanceSummaryResponse(BaseModel):
    event_id: int
    event_name: str
    going_attended: AttendanceSummaryCategoryResponse
    going_no_show: AttendanceSummaryCategoryResponse
    walk_ins: AttendanceSummaryCategoryResponse
    not_going: AttendanceSummaryCategoryResponse
    guests_checked_in: GuestAttendanceSummaryResponse
