from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from app.lib.semester import SEMESTER_QUERY_PATTERN, format_semester_label


class ReportRangeType(StrEnum):
    SEMESTER = "semester"
    CUSTOM = "custom"


class ReportGenerateRequest(BaseModel):
    range_type: ReportRangeType
    semester: str | None = Field(default=None, pattern=SEMESTER_QUERY_PATTERN)
    period_start: datetime | None = None
    period_end: datetime | None = None

    @model_validator(mode="after")
    def validate_range(self) -> "ReportGenerateRequest":
        if self.range_type == ReportRangeType.SEMESTER:
            if not self.semester:
                raise ValueError("semester is required when range_type is semester")
        elif self.range_type == ReportRangeType.CUSTOM:
            if self.period_start is None or self.period_end is None:
                raise ValueError(
                    "period_start and period_end are required when range_type is custom",
                )
            start = self.period_start
            end = self.period_end
            if start.tzinfo is None:
                start = start.replace(tzinfo=UTC)
            if end.tzinfo is None:
                end = end.replace(tzinfo=UTC)
            if end <= start:
                raise ValueError("period_end must be after period_start")
        return self


class ReportEventSummary(BaseModel):
    id: int
    name: str
    starts_at: datetime
    event_type: str
    attendance_count: int
    member_checkins: int
    guest_checkins: int
    rsvp_going_attended: int
    rsvp_going_no_show: int
    walk_ins: int


class ReportEventsSection(BaseModel):
    total_events: int
    events: list[ReportEventSummary]


class ReportAttendanceSection(BaseModel):
    total_member_checkins: int
    total_guest_checkins: int
    total_checkins: int
    events_with_checkins: int


class ReportFinanceSection(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    net_balance: Decimal
    entry_count: int


class ReportDuesSection(BaseModel):
    semesters: list[str]
    total_expected: Decimal
    total_collected: Decimal
    total_outstanding: Decimal
    paid_count: int
    unpaid_count: int
    partial_count: int
    exempt_count: int
    member_count: int


class ReportFeedbackSection(BaseModel):
    response_count: int
    average_rating: float | None
    events_with_feedback: int


class ReportMembershipSection(BaseModel):
    total_approved: int
    board_plus_count: int
    general_count: int


class ReportData(BaseModel):
    title: str
    period_label: str
    range_type: ReportRangeType
    semester: str | None
    period_start: datetime
    period_end: datetime
    generated_at: datetime
    events: ReportEventsSection
    attendance: ReportAttendanceSection
    finance: ReportFinanceSection
    dues: ReportDuesSection
    feedback: ReportFeedbackSection
    membership: ReportMembershipSection


class ReportListItemResponse(BaseModel):
    id: int
    title: str
    range_type: ReportRangeType
    semester: str | None
    period_start: datetime
    period_end: datetime
    period_label: str
    generated_by_name: str
    created_at: datetime

    @classmethod
    def from_report(cls, report, *, generated_by_name: str) -> "ReportListItemResponse":
        return cls(
            id=report.id,
            title=report.title,
            range_type=report.range_type,
            semester=report.semester,
            period_start=report.period_start,
            period_end=report.period_end,
            period_label=_period_label_from_report(report),
            generated_by_name=generated_by_name,
            created_at=report.created_at,
        )


class ReportDetailResponse(BaseModel):
    id: int
    title: str
    range_type: ReportRangeType
    semester: str | None
    period_start: datetime
    period_end: datetime
    generated_by_name: str
    created_at: datetime
    data: ReportData


class ReportListResponse(BaseModel):
    reports: list[ReportListItemResponse]
    total: int


def _period_label_from_report(report) -> str:
    if report.semester:
        return format_semester_label(report.semester)
    start = report.period_start.astimezone(UTC).date().isoformat()
    end = report.period_end.astimezone(UTC).date().isoformat()
    return f"{start} to {end}"
