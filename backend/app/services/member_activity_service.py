"""
Member-scoped recent activity aggregation.

Sources (real timestamps only):
  - completed event tasks → completed_at
  - dues payments → paid_at
  - event check-ins → checked_in_at
  - meeting notes authored → meeting_records.updated_at

Deferred (no audit trail yet — do not invent):
  - RSVP status changes
  - role / status / position changes
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import member_has_role_at_least
from app.models.event_checkin import EventCheckIn
from app.models.event_task import EventTask
from app.models.meeting import MeetingRecord
from app.models.member import Member, MemberPosition, MemberRole
from app.models.member_dues import MemberDues
from app.schemas.member_activity import (
    MemberActivityItemResponse,
    MemberActivityListResponse,
    MemberActivityType,
)
from app.services.member_service import MemberNotFoundError, get_member_by_id


def _can_view_task_activity(viewer: Member, subject_id: int) -> bool:
    """Mirror fetchMyEventTasks (self) + require_task_oversight (president/VP)."""
    if viewer.id == subject_id:
        return True
    return (
        viewer.role == MemberRole.PRESIDENT
        or viewer.position == MemberPosition.VICE_PRESIDENT
    )


def _can_view_dues_activity(viewer: Member, subject_id: int) -> bool:
    """Self can see own payments; otherwise treasury-writer (treasurer+/VP)."""
    if viewer.id == subject_id:
        return True
    if viewer.has_role_at_least(MemberRole.TREASURER):
        return True
    return viewer.position == MemberPosition.VICE_PRESIDENT


def _can_view_checkin_activity(viewer: Member, subject_id: int) -> bool:
    """Self can see own check-ins; board+ can see others (same as list check-ins)."""
    if viewer.id == subject_id:
        return True
    return member_has_role_at_least(viewer, MemberRole.BOARD)


def _can_view_meeting_notes_activity(viewer: Member, subject_id: int) -> bool:
    """Self can see own notes; board+ can see notes authored by others."""
    if viewer.id == subject_id:
        return True
    return member_has_role_at_least(viewer, MemberRole.BOARD)


def _task_description(task: EventTask) -> str:
    title = (task.title or "task").strip() or "task"
    event_name = task.event.title if task.event is not None else None
    if event_name:
        return f"Completed '{title}' for {event_name}"
    return f"Completed '{title}'"


def _dues_description(record: MemberDues) -> str:
    semester = (record.semester or "").strip()
    if semester:
        return f"Paid membership dues ({semester})"
    return "Paid membership dues"


def _checkin_description(checkin: EventCheckIn) -> str:
    event_name = checkin.event.title if checkin.event is not None else "event"
    return f"Attended {event_name}"


def _meeting_notes_description(record: MeetingRecord) -> str:
    event_name = record.event.title if record.event is not None else "meeting"
    if record.summary:
        return f"Published meeting notes for {event_name}"
    return f"Updated meeting notes for {event_name}"


def get_member_activity(
    db: Session,
    *,
    member_id: int,
    viewer: Member,
    limit: int = 50,
) -> MemberActivityListResponse:
    try:
        get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise

    items: list[MemberActivityItemResponse] = []

    if _can_view_task_activity(viewer, member_id):
        tasks = db.scalars(
            select(EventTask)
            .where(
                EventTask.assignee_id == member_id,
                EventTask.completed_at.is_not(None),
            )
            .options(selectinload(EventTask.event))
            .order_by(EventTask.completed_at.desc(), EventTask.id.desc()),
        ).all()
        for task in tasks:
            assert task.completed_at is not None
            items.append(
                MemberActivityItemResponse(
                    id=f"task_completed-{task.id}",
                    type=MemberActivityType.TASK_COMPLETED,
                    description=_task_description(task),
                    timestamp=task.completed_at,
                    task_id=task.id,
                    event_id=task.event_id,
                ),
            )

    if _can_view_dues_activity(viewer, member_id):
        dues_rows = db.scalars(
            select(MemberDues)
            .where(
                MemberDues.member_id == member_id,
                MemberDues.paid_at.is_not(None),
            )
            .order_by(MemberDues.paid_at.desc(), MemberDues.id.desc()),
        ).all()
        for record in dues_rows:
            assert record.paid_at is not None
            items.append(
                MemberActivityItemResponse(
                    id=f"dues_paid-{record.id}",
                    type=MemberActivityType.DUES_PAID,
                    description=_dues_description(record),
                    timestamp=record.paid_at,
                    dues_record_id=record.id,
                ),
            )

    if _can_view_checkin_activity(viewer, member_id):
        checkins = db.scalars(
            select(EventCheckIn)
            .where(EventCheckIn.member_id == member_id)
            .options(selectinload(EventCheckIn.event))
            .order_by(EventCheckIn.checked_in_at.desc(), EventCheckIn.id.desc()),
        ).all()
        for checkin in checkins:
            items.append(
                MemberActivityItemResponse(
                    id=f"event_checkin-{checkin.id}",
                    type=MemberActivityType.EVENT_CHECKIN,
                    description=_checkin_description(checkin),
                    timestamp=checkin.checked_in_at,
                    event_id=checkin.event_id,
                ),
            )

    if _can_view_meeting_notes_activity(viewer, member_id):
        notes_rows = db.scalars(
            select(MeetingRecord)
            .where(
                MeetingRecord.updated_by_id == member_id,
                MeetingRecord.raw_notes != "",
            )
            .options(selectinload(MeetingRecord.event))
            .order_by(MeetingRecord.updated_at.desc(), MeetingRecord.id.desc()),
        ).all()
        for record in notes_rows:
            if not (record.raw_notes or "").strip():
                continue
            items.append(
                MemberActivityItemResponse(
                    id=f"meeting_notes-{record.id}",
                    type=MemberActivityType.MEETING_NOTES,
                    description=_meeting_notes_description(record),
                    timestamp=record.updated_at,
                    event_id=record.event_id,
                ),
            )

    items.sort(key=lambda item: (item.timestamp, item.id), reverse=True)
    if limit > 0:
        items = items[:limit]

    return MemberActivityListResponse(items=items, total=len(items))
