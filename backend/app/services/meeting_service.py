from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event, EventType
from app.models.meeting import (
    MeetingAttendance,
    MeetingAttendanceStatus,
    MeetingRecord,
)
from app.models.member import Member
from app.schemas.ai import SummarizeMinutesResponse
from app.schemas.meeting import (
    MeetingActionItemResponse,
    MeetingAttendanceEntryResponse,
    MeetingAttendanceUpdateItem,
    MeetingDetailResponse,
    MeetingListResponse,
    MeetingMinutesResponse,
    MeetingSummaryResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.meeting_notification_service import notify_board_of_meeting_update
from app.services.member_service import list_assignable_board_members


class NotMeetingEventError(Exception):
    pass


class InvalidMeetingAttendeeError(Exception):
    pass


def can_manage_meeting_records(member: Member) -> bool:
    from app.models.member import MemberPosition, MemberRole

    return (
        member.role == MemberRole.PRESIDENT
        or member.position == MemberPosition.SECRETARY
        or member.position == MemberPosition.VICE_PRESIDENT
    )


def _get_meeting_event(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    if event.event_type != EventType.MEETING:
        raise NotMeetingEventError
    return event


def _get_or_create_meeting_record(db: Session, event_id: int) -> MeetingRecord:
    record = db.scalar(
        select(MeetingRecord).where(MeetingRecord.event_id == event_id),
    )
    if record is not None:
        return record

    record = MeetingRecord(event_id=event_id, raw_notes="")
    db.add(record)
    db.flush()
    return record


def _build_minutes_response(record: MeetingRecord | None) -> MeetingMinutesResponse:
    if record is None:
        return MeetingMinutesResponse(raw_notes="")

    updated_by_name = record.updated_by.full_name if record.updated_by else None
    action_items = [
        MeetingActionItemResponse.model_validate(item)
        for item in (record.action_items or [])
    ]

    return MeetingMinutesResponse(
        raw_notes=record.raw_notes or "",
        summary=record.summary,
        key_decisions=list(record.key_decisions or []),
        action_items=action_items,
        updated_at=record.updated_at,
        updated_by_name=updated_by_name,
    )


def _attendance_counts(
    board_member_count: int,
    attendance_rows: list[MeetingAttendance],
) -> tuple[int, int, int, int]:
    present_count = 0
    absent_count = 0
    excused_count = 0
    for row in attendance_rows:
        if row.status == MeetingAttendanceStatus.PRESENT:
            present_count += 1
        elif row.status == MeetingAttendanceStatus.ABSENT:
            absent_count += 1
        elif row.status == MeetingAttendanceStatus.EXCUSED:
            excused_count += 1
    unmarked_count = board_member_count - len(attendance_rows)
    return present_count, absent_count, excused_count, unmarked_count


def _build_meeting_summary(
    event: Event,
    *,
    record: MeetingRecord | None,
    attendance_rows: list[MeetingAttendance],
    board_member_count: int,
) -> MeetingSummaryResponse:
    present_count, absent_count, excused_count, unmarked_count = _attendance_counts(
        board_member_count,
        attendance_rows,
    )
    has_attendance = len(attendance_rows) > 0
    raw_notes = (record.raw_notes or "").strip() if record else ""
    has_minutes = bool(raw_notes)
    has_summary = bool(record and record.summary)

    return MeetingSummaryResponse(
        event_id=event.id,
        event_name=event.title,
        starts_at=event.starts_at,
        is_past=not event.is_upcoming,
        agenda=event.description,
        has_attendance=has_attendance,
        has_minutes=has_minutes,
        has_summary=has_summary,
        present_count=present_count,
        absent_count=absent_count,
        excused_count=excused_count,
        unmarked_count=unmarked_count,
        minutes_updated_at=record.updated_at if record else None,
    )


def list_meetings(db: Session) -> MeetingListResponse:
    events = db.scalars(
        select(Event)
        .where(Event.event_type == EventType.MEETING)
        .order_by(Event.starts_at.desc()),
    ).all()
    if not events:
        return MeetingListResponse(meetings=[], total=0)

    event_ids = [event.id for event in events]
    records = {
        record.event_id: record
        for record in db.scalars(
            select(MeetingRecord).where(MeetingRecord.event_id.in_(event_ids)),
        ).all()
    }
    attendance_by_event: dict[int, list[MeetingAttendance]] = {
        event_id: [] for event_id in event_ids
    }
    for row in db.scalars(
        select(MeetingAttendance).where(MeetingAttendance.event_id.in_(event_ids)),
    ).all():
        attendance_by_event[row.event_id].append(row)

    board_member_count = len(list_assignable_board_members(db))
    summaries = [
        _build_meeting_summary(
            event,
            record=records.get(event.id),
            attendance_rows=attendance_by_event.get(event.id, []),
            board_member_count=board_member_count,
        )
        for event in events
    ]
    return MeetingListResponse(meetings=summaries, total=len(summaries))


def get_meeting_detail(
    db: Session,
    event_id: int,
    *,
    viewer: Member,
) -> MeetingDetailResponse:
    event = _get_meeting_event(db, event_id)
    record = db.scalar(
        select(MeetingRecord)
        .where(MeetingRecord.event_id == event_id)
        .options(joinedload(MeetingRecord.updated_by)),
    )
    board_members = list_assignable_board_members(db)
    attendance_rows = {
        row.member_id: row
        for row in db.scalars(
            select(MeetingAttendance).where(MeetingAttendance.event_id == event_id),
        ).all()
    }

    attendance: list[MeetingAttendanceEntryResponse] = []
    present_count = 0
    absent_count = 0
    excused_count = 0
    unmarked_count = 0

    for member in board_members:
        row = attendance_rows.get(member.id)
        status = row.status if row else None
        if status == MeetingAttendanceStatus.PRESENT:
            present_count += 1
        elif status == MeetingAttendanceStatus.ABSENT:
            absent_count += 1
        elif status == MeetingAttendanceStatus.EXCUSED:
            excused_count += 1
        else:
            unmarked_count += 1

        if member.custom_board_position is not None:
            position_label = member.custom_board_position.name
        else:
            position_label = member.position.value

        attendance.append(
            MeetingAttendanceEntryResponse(
                member_id=member.id,
                full_name=member.full_name,
                position=position_label,
                role=member.role.value,
                status=status,
            ),
        )

    return MeetingDetailResponse(
        event_id=event.id,
        event_name=event.title,
        agenda=event.description,
        starts_at=event.starts_at,
        is_past=not event.is_upcoming,
        can_manage=can_manage_meeting_records(viewer),
        minutes=_build_minutes_response(record),
        attendance=attendance,
        present_count=present_count,
        absent_count=absent_count,
        excused_count=excused_count,
        unmarked_count=unmarked_count,
    )


def update_meeting_notes(
    db: Session,
    event_id: int,
    *,
    raw_notes: str,
    updated_by: Member,
) -> MeetingMinutesResponse:
    _get_meeting_event(db, event_id)
    record = _get_or_create_meeting_record(db, event_id)
    previous_notes = (record.raw_notes or "").strip()
    record.raw_notes = raw_notes
    record.updated_by_id = updated_by.id
    db.commit()
    record = db.scalar(
        select(MeetingRecord)
        .where(MeetingRecord.event_id == event_id)
        .options(joinedload(MeetingRecord.updated_by)),
    )

    trimmed_notes = raw_notes.strip()
    if trimmed_notes and not previous_notes:
        notify_board_of_meeting_update(
            db,
            event_id=event_id,
            updated_by=updated_by,
            notification_kind="notes",
        )

    return _build_minutes_response(record)


def save_meeting_summary(
    db: Session,
    event_id: int,
    *,
    raw_notes: str,
    summary: SummarizeMinutesResponse,
    updated_by: Member,
) -> MeetingMinutesResponse:
    _get_meeting_event(db, event_id)
    record = _get_or_create_meeting_record(db, event_id)
    record.raw_notes = raw_notes
    record.summary = summary.summary
    record.key_decisions = summary.key_decisions
    record.action_items = [item.model_dump() for item in summary.action_items]
    record.updated_by_id = updated_by.id
    db.commit()
    record = db.scalar(
        select(MeetingRecord)
        .where(MeetingRecord.event_id == event_id)
        .options(joinedload(MeetingRecord.updated_by)),
    )

    notify_board_of_meeting_update(
        db,
        event_id=event_id,
        updated_by=updated_by,
        notification_kind="summary",
    )

    return _build_minutes_response(record)


def _validate_attendance_entries(
    db: Session,
    *,
    entries: list[MeetingAttendanceUpdateItem],
) -> None:
    assignable_ids = {member.id for member in list_assignable_board_members(db)}
    for entry in entries:
        if entry.member_id not in assignable_ids:
            raise InvalidMeetingAttendeeError


def update_meeting_attendance(
    db: Session,
    event_id: int,
    *,
    entries: list[MeetingAttendanceUpdateItem],
    updated_by: Member,
) -> MeetingDetailResponse:
    _get_meeting_event(db, event_id)
    _validate_attendance_entries(db, entries=entries)

    existing_rows = {
        row.member_id: row
        for row in db.scalars(
            select(MeetingAttendance).where(MeetingAttendance.event_id == event_id),
        ).all()
    }

    for entry in entries:
        row = existing_rows.get(entry.member_id)
        if row is None:
            row = MeetingAttendance(
                event_id=event_id,
                member_id=entry.member_id,
            )
            db.add(row)
        row.status = entry.status
        row.updated_by_id = updated_by.id

    db.commit()

    notify_board_of_meeting_update(
        db,
        event_id=event_id,
        updated_by=updated_by,
        notification_kind="attendance",
    )

    return get_meeting_detail(db, event_id, viewer=updated_by)
