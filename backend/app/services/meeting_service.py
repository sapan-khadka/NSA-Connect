from datetime import UTC, datetime

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
from app.services.minutes_fingerprint import published_minutes_fingerprint
from app.services.organization_context import resolve_organization_id

MEETING_DRAFT_CONFLICT_DETAIL = (
    "These minutes were updated by someone else. Reload them and try again."
)
MEETING_REGENERATE_DETAIL = (
    "Regenerating will replace the unpublished draft. Confirm to continue."
)
MEETING_PUBLISH_REQUIRED_DETAIL = "Save a draft before publishing minutes."
MEETING_PUBLISH_OVERVIEW_DETAIL = "Add an overview before publishing minutes."


class NotMeetingEventError(Exception):
    pass


class InvalidMeetingAttendeeError(Exception):
    pass


class MeetingDraftConflictError(Exception):
    pass


class MeetingRegenerateConfirmationError(Exception):
    pass


class MeetingDraftRequiredError(Exception):
    pass


class MeetingOverviewRequiredError(Exception):
    pass


def can_manage_meeting_records(member: Member) -> bool:
    from app.core.permissions import can_manage_meetings

    return can_manage_meetings(member)


def _get_meeting_event(db: Session, event_id: int, viewer: Member) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.organization_id != resolve_organization_id(db, viewer):
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


def _action_item_responses(items: list | None) -> list[MeetingActionItemResponse]:
    return [MeetingActionItemResponse.model_validate(item) for item in (items or [])]


def _reload_record(db: Session, event_id: int) -> MeetingRecord | None:
    return db.scalar(
        select(MeetingRecord)
        .where(MeetingRecord.event_id == event_id)
        .options(
            joinedload(MeetingRecord.updated_by),
            joinedload(MeetingRecord.draft_updated_by),
        )
    )


def _locked_record(db: Session, event_id: int) -> MeetingRecord:
    record = _get_or_create_meeting_record(db, event_id)
    if db.get_bind().dialect.name == "postgresql":
        # The row may already be in this session from an earlier read. Expire it
        # so the locked SELECT returns the version committed by the other writer.
        db.expire(record)
        locked = db.scalar(
            select(MeetingRecord)
            .where(MeetingRecord.id == record.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if locked is not None:
            return locked
    db.refresh(record)
    return record


def _clear_draft(record: MeetingRecord) -> None:
    record.draft_summary = None
    record.draft_key_decisions = None
    record.draft_action_items = None
    record.draft_updated_at = None
    record.draft_updated_by_id = None
    record.draft_version = None


def _build_minutes_response(
    record: MeetingRecord | None,
    *,
    include_draft: bool,
) -> MeetingMinutesResponse:
    if record is None:
        return MeetingMinutesResponse(raw_notes="")

    updated_by_name = record.updated_by.full_name if record.updated_by else None
    draft_visible = include_draft and record.draft_version is not None
    draft_updated_by_name = None
    if draft_visible and record.draft_updated_by is not None:
        draft_updated_by_name = record.draft_updated_by.full_name

    return MeetingMinutesResponse(
        raw_notes=record.raw_notes or "",
        summary=record.summary,
        key_decisions=list(record.key_decisions or []),
        action_items=_action_item_responses(record.action_items),
        updated_at=record.updated_at,
        updated_by_name=updated_by_name,
        published_at=record.published_at,
        draft_summary=record.draft_summary if draft_visible else None,
        draft_key_decisions=list(record.draft_key_decisions or []) if draft_visible else [],
        draft_action_items=(
            _action_item_responses(record.draft_action_items) if draft_visible else []
        ),
        draft_updated_at=record.draft_updated_at if draft_visible else None,
        draft_updated_by_name=draft_updated_by_name,
        draft_version=record.draft_version if draft_visible else None,
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
    action_items = (record.action_items or []) if record else []
    action_item_count = len(action_items) if isinstance(action_items, list) else 0

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
        action_item_count=action_item_count,
        minutes_updated_at=record.updated_at if record else None,
    )


def list_meetings(db: Session, viewer: Member) -> MeetingListResponse:
    organization_id = resolve_organization_id(db, viewer)
    events = db.scalars(
        select(Event)
        .where(
            Event.event_type == EventType.MEETING,
            Event.organization_id == organization_id,
        )
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
    event = _get_meeting_event(db, event_id, viewer)
    record = _reload_record(db, event_id)
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
        minutes=_build_minutes_response(
            record,
            include_draft=can_manage_meeting_records(viewer),
        ),
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
    _get_meeting_event(db, event_id, updated_by)
    record = _get_or_create_meeting_record(db, event_id)
    previous_notes = (record.raw_notes or "").strip()
    record.raw_notes = raw_notes
    record.updated_by_id = updated_by.id
    db.commit()
    record = _reload_record(db, event_id)

    trimmed_notes = raw_notes.strip()
    if trimmed_notes and not previous_notes:
        notify_board_of_meeting_update(
            db,
            event_id=event_id,
            updated_by=updated_by,
            notification_kind="notes",
        )

    return _build_minutes_response(record, include_draft=True)


def assert_minutes_can_regenerate(
    db: Session,
    event_id: int,
    *,
    viewer: Member,
    confirm_regenerate: bool,
    base_draft_version: int | None,
) -> None:
    """Reject a replacement before calling the model."""
    _get_meeting_event(db, event_id, viewer)
    record = db.scalar(select(MeetingRecord).where(MeetingRecord.event_id == event_id))
    current = record.draft_version if record is not None else None
    if current != base_draft_version:
        raise MeetingDraftConflictError
    if current is not None and not confirm_regenerate:
        raise MeetingRegenerateConfirmationError


def save_generated_minutes_draft(
    db: Session,
    event_id: int,
    *,
    raw_notes: str,
    summary: SummarizeMinutesResponse,
    updated_by: Member,
    confirm_regenerate: bool,
    base_draft_version: int | None,
) -> MeetingMinutesResponse:
    """Store a review draft. Published minutes and notifications stay unchanged."""
    _get_meeting_event(db, event_id, updated_by)
    record = _locked_record(db, event_id)
    if record.draft_version != base_draft_version:
        raise MeetingDraftConflictError
    if record.draft_version is not None and not confirm_regenerate:
        raise MeetingRegenerateConfirmationError

    record.raw_notes = raw_notes
    record.draft_summary = summary.summary
    record.draft_key_decisions = list(summary.key_decisions)
    record.draft_action_items = [item.model_dump() for item in summary.action_items]
    record.draft_updated_by_id = updated_by.id
    record.draft_updated_at = datetime.now(UTC)
    record.draft_version = (record.draft_version or 0) + 1
    db.commit()
    return _build_minutes_response(_reload_record(db, event_id), include_draft=True)


def save_minutes_draft(
    db: Session,
    event_id: int,
    *,
    summary: str,
    key_decisions: list[str],
    action_items: list[MeetingActionItemResponse],
    base_draft_version: int | None,
    updated_by: Member,
) -> MeetingMinutesResponse:
    """Save manager edits without changing raw notes or the published record."""
    _get_meeting_event(db, event_id, updated_by)
    record = _locked_record(db, event_id)
    if record.draft_version != base_draft_version:
        raise MeetingDraftConflictError

    record.draft_summary = summary
    record.draft_key_decisions = list(key_decisions)
    record.draft_action_items = [item.model_dump() for item in action_items]
    record.draft_updated_by_id = updated_by.id
    record.draft_updated_at = datetime.now(UTC)
    record.draft_version = (record.draft_version or 0) + 1
    db.commit()
    return _build_minutes_response(_reload_record(db, event_id), include_draft=True)


def publish_meeting_minutes(
    db: Session,
    event_id: int,
    *,
    base_draft_version: int,
    updated_by: Member,
) -> MeetingMinutesResponse:
    _get_meeting_event(db, event_id, updated_by)
    record = _locked_record(db, event_id)
    if record.draft_version is None:
        raise MeetingDraftRequiredError
    if record.draft_version != base_draft_version:
        raise MeetingDraftConflictError

    summary = (record.draft_summary or "").strip()
    if not summary:
        raise MeetingOverviewRequiredError

    decisions = [
        text
        for item in (record.draft_key_decisions or [])
        if (text := str(item).strip())
    ]
    items = _action_item_responses(record.draft_action_items)
    fingerprint = published_minutes_fingerprint(
        summary,
        decisions,
        [item.model_dump() for item in items],
    )
    changed = fingerprint != record.published_fingerprint
    if changed:
        record.summary = summary
        record.key_decisions = decisions
        record.action_items = [item.model_dump() for item in items]
        record.published_at = datetime.now(UTC)
        record.published_fingerprint = fingerprint
        record.updated_by_id = updated_by.id
    _clear_draft(record)
    db.commit()

    if changed:
        notify_board_of_meeting_update(
            db,
            event_id=event_id,
            updated_by=updated_by,
            notification_kind="summary",
        )

    return _build_minutes_response(_reload_record(db, event_id), include_draft=True)


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
    _get_meeting_event(db, event_id, updated_by)
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
