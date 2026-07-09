from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.lib.semester import (
    format_semester_label,
    semester_date_range,
    semesters_overlapping_range,
)
from app.models.event import Event
from app.models.event_checkin import EventCheckIn
from app.models.event_feedback import EventFeedback
from app.models.event_guest_checkin import EventGuestCheckIn
from app.models.finance_entry import FinanceEntry, FinanceEntryType
from app.models.member import Member, MemberRole, MemberStatus
from app.models.semester_report import ReportRangeType, SemesterReport
from app.schemas.report import (
    ReportAttendanceSection,
    ReportData,
    ReportDuesSection,
    ReportEventsSection,
    ReportEventSummary,
    ReportFeedbackSection,
    ReportFinanceSection,
    ReportGenerateRequest,
    ReportMembershipSection,
)
from app.services.dues_service import get_dues_dashboard
from app.services.event_checkin_service import get_attendance_summary


class ReportNotFoundError(Exception):
    pass


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _resolve_period(
    request: ReportGenerateRequest,
) -> tuple[datetime, datetime, str | None, str]:
    if request.range_type == ReportRangeType.SEMESTER:
        assert request.semester is not None
        start, end = semester_date_range(request.semester)
        label = format_semester_label(request.semester)
        title = f"{label} End-of-Semester Report"
        return start, end, request.semester, title

    assert request.period_start is not None and request.period_end is not None
    start = _as_utc(request.period_start)
    end = _as_utc(request.period_end)
    start_label = start.date().isoformat()
    end_label = end.date().isoformat()
    label = f"{start_label} to {end_label}"
    title = f"Report ({label})"
    return start, end, None, title


def _income_sum():
    return func.coalesce(
        func.sum(
            case(
                (
                    FinanceEntry.entry_type == FinanceEntryType.INCOME,
                    FinanceEntry.amount,
                ),
                else_=Decimal("0"),
            ),
        ),
        Decimal("0"),
    )


def _expense_sum():
    return func.coalesce(
        func.sum(
            case(
                (
                    FinanceEntry.entry_type == FinanceEntryType.EXPENSE,
                    FinanceEntry.amount,
                ),
                else_=Decimal("0"),
            ),
        ),
        Decimal("0"),
    )


def _build_finance_section(
    db: Session,
    *,
    period_start: datetime,
    period_end: datetime,
) -> ReportFinanceSection:
    filters = [
        FinanceEntry.created_at >= period_start,
        FinanceEntry.created_at < period_end,
    ]
    row = db.execute(
        select(
            _income_sum(),
            _expense_sum(),
            func.count(FinanceEntry.id),
        ).where(*filters),
    ).one()
    total_income = Decimal(row[0])
    total_expense = Decimal(row[1])
    return ReportFinanceSection(
        total_income=total_income,
        total_expense=total_expense,
        net_balance=total_income - total_expense,
        entry_count=row[2],
    )


def _build_dues_section(
    db: Session,
    *,
    period_start: datetime,
    period_end: datetime,
) -> ReportDuesSection:
    semesters = semesters_overlapping_range(period_start, period_end)
    total_expected = Decimal("0")
    total_collected = Decimal("0")
    total_outstanding = Decimal("0")
    paid_count = 0
    unpaid_count = 0
    partial_count = 0
    exempt_count = 0
    member_count = 0

    for semester in semesters:
        dashboard = get_dues_dashboard(db, semester=semester)
        summary = dashboard.summary
        total_expected += summary.total_expected
        total_collected += summary.total_collected
        total_outstanding += summary.total_outstanding
        paid_count += summary.paid_count
        unpaid_count += summary.unpaid_count
        partial_count += summary.partial_count
        exempt_count += summary.exempt_count
        member_count += summary.member_count

    return ReportDuesSection(
        semesters=semesters,
        total_expected=total_expected,
        total_collected=total_collected,
        total_outstanding=total_outstanding,
        paid_count=paid_count,
        unpaid_count=unpaid_count,
        partial_count=partial_count,
        exempt_count=exempt_count,
        member_count=member_count,
    )


def _build_feedback_section(
    db: Session,
    *,
    event_ids: list[int],
) -> ReportFeedbackSection:
    if not event_ids:
        return ReportFeedbackSection(
            response_count=0,
            average_rating=None,
            events_with_feedback=0,
        )

    rows = db.execute(
        select(
            EventFeedback.event_id,
            func.avg(EventFeedback.rating),
            func.count(EventFeedback.id),
        )
        .where(EventFeedback.event_id.in_(event_ids))
        .group_by(EventFeedback.event_id),
    ).all()

    response_count = sum(row[2] for row in rows)
    if response_count == 0:
        return ReportFeedbackSection(
            response_count=0,
            average_rating=None,
            events_with_feedback=0,
        )

    weighted_sum = sum(Decimal(str(row[1])) * row[2] for row in rows)
    average = float(round(weighted_sum / response_count, 1))
    return ReportFeedbackSection(
        response_count=response_count,
        average_rating=average,
        events_with_feedback=len(rows),
    )


def _build_membership_section(db: Session) -> ReportMembershipSection:
    rows = db.execute(
        select(Member.role, func.count())
        .where(Member.status == MemberStatus.APPROVED)
        .group_by(Member.role),
    ).all()

    total_approved = 0
    board_plus_count = 0
    for role, count in rows:
        total_approved += count
        member_role = role if isinstance(role, MemberRole) else MemberRole(role)
        if member_role.is_at_least(MemberRole.BOARD):
            board_plus_count += count

    return ReportMembershipSection(
        total_approved=total_approved,
        board_plus_count=board_plus_count,
        general_count=total_approved - board_plus_count,
    )


def _build_events_and_attendance(
    db: Session,
    *,
    period_start: datetime,
    period_end: datetime,
) -> tuple[ReportEventsSection, ReportAttendanceSection]:
    events = list(
        db.scalars(
            select(Event)
            .where(Event.starts_at >= period_start, Event.starts_at < period_end)
            .order_by(Event.starts_at.asc()),
        ).all(),
    )

    event_summaries: list[ReportEventSummary] = []
    total_member_checkins = 0
    total_guest_checkins = 0
    events_with_checkins = 0

    for event in events:
        summary = get_attendance_summary(db, event.id)
        member_checkins = (
            db.scalar(
                select(func.count())
                .select_from(EventCheckIn)
                .where(EventCheckIn.event_id == event.id),
            )
            or 0
        )
        guest_checkins = (
            db.scalar(
                select(func.count())
                .select_from(EventGuestCheckIn)
                .where(EventGuestCheckIn.event_id == event.id),
            )
            or 0
        )
        attendance_count = member_checkins + guest_checkins

        if attendance_count > 0:
            events_with_checkins += 1

        total_member_checkins += member_checkins
        total_guest_checkins += guest_checkins

        event_summaries.append(
            ReportEventSummary(
                id=event.id,
                name=event.title,
                starts_at=event.starts_at,
                event_type=event.event_type.value,
                attendance_count=attendance_count,
                member_checkins=member_checkins,
                guest_checkins=guest_checkins,
                rsvp_going_attended=summary["going_attended"]["count"],
                rsvp_going_no_show=summary["going_no_show"]["count"],
                walk_ins=summary["walk_ins"]["count"],
            ),
        )

    attendance = ReportAttendanceSection(
        total_member_checkins=total_member_checkins,
        total_guest_checkins=total_guest_checkins,
        total_checkins=total_member_checkins + total_guest_checkins,
        events_with_checkins=events_with_checkins,
    )
    events_section = ReportEventsSection(
        total_events=len(events),
        events=event_summaries,
    )
    return events_section, attendance


def build_report_data(
    db: Session,
    request: ReportGenerateRequest,
) -> ReportData:
    period_start, period_end, semester, title = _resolve_period(request)
    events_section, attendance_section = _build_events_and_attendance(
        db,
        period_start=period_start,
        period_end=period_end,
    )
    event_ids = [event.id for event in events_section.events]

    return ReportData(
        title=title,
        period_label=format_semester_label(semester)
        if semester
        else (f"{period_start.date().isoformat()} to {period_end.date().isoformat()}"),
        range_type=request.range_type,
        semester=semester,
        period_start=period_start,
        period_end=period_end,
        generated_at=datetime.now(UTC),
        events=events_section,
        attendance=attendance_section,
        finance=_build_finance_section(
            db,
            period_start=period_start,
            period_end=period_end,
        ),
        dues=_build_dues_section(
            db,
            period_start=period_start,
            period_end=period_end,
        ),
        feedback=_build_feedback_section(db, event_ids=event_ids),
        membership=_build_membership_section(db),
    )


def generate_report(
    db: Session,
    request: ReportGenerateRequest,
    *,
    generated_by_id: int,
) -> SemesterReport:
    data = build_report_data(db, request)
    period_start, period_end, semester, title = _resolve_period(request)

    report = SemesterReport(
        title=title,
        range_type=request.range_type.value,
        semester=semester,
        period_start=period_start,
        period_end=period_end,
        data_json=data.model_dump_json(),
        generated_by_id=generated_by_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_reports(db: Session) -> list[SemesterReport]:
    return list(
        db.scalars(
            select(SemesterReport)
            .options(joinedload(SemesterReport.generated_by))
            .order_by(SemesterReport.created_at.desc()),
        )
        .unique()
        .all(),
    )


def get_report(db: Session, report_id: int) -> SemesterReport:
    report = db.scalar(
        select(SemesterReport)
        .options(joinedload(SemesterReport.generated_by))
        .where(SemesterReport.id == report_id),
    )
    if report is None:
        raise ReportNotFoundError
    return report


def load_report_data(report: SemesterReport) -> ReportData:
    return ReportData.model_validate_json(report.data_json)
