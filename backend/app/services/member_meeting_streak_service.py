"""
Deterministic meeting miss streak for Member Workspace insights.

Uses MeetingAttendance (present/absent/excused) — the only source that records
misses. Event QR check-ins are presence-only and cannot prove absences.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventType
from app.models.meeting import MeetingAttendance, MeetingAttendanceStatus
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.member_insights import MemberMeetingAttendanceStreakResponse
from app.services.member_service import MemberNotFoundError, get_member_by_id


class MemberMeetingStreakPermissionError(Exception):
    pass


def can_view_member_meeting_streak(viewer: Member, member_id: int) -> bool:
    """Self or board+ — same visibility tier as check-in activity."""
    if viewer.id == member_id:
        return True
    return viewer.has_role_at_least(MemberRole.BOARD)


def get_member_consecutive_missed_meetings(
    db: Session,
    *,
    member_id: int,
    viewer: Member,
) -> MemberMeetingAttendanceStreakResponse:
    if not can_view_member_meeting_streak(viewer, member_id):
        raise MemberMeetingStreakPermissionError

    try:
        subject = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise

    if subject.status != MemberStatus.APPROVED and not viewer.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise MemberNotFoundError

    now = datetime.now(UTC)
    rows = db.execute(
        select(MeetingAttendance, Event.starts_at)
        .join(Event, Event.id == MeetingAttendance.event_id)
        .where(
            MeetingAttendance.member_id == member_id,
            Event.event_type == EventType.MEETING,
            Event.starts_at < now,
        )
        .order_by(Event.starts_at.desc(), MeetingAttendance.id.desc()),
    ).all()

    consecutive = 0
    for attendance, _starts_at in rows:
        if attendance.status == MeetingAttendanceStatus.ABSENT:
            consecutive += 1
            continue
        if attendance.status == MeetingAttendanceStatus.PRESENT:
            break
        # EXCUSED: skip without counting or breaking the trailing miss streak.

    return MemberMeetingAttendanceStreakResponse(
        member_id=member_id,
        consecutive_missed_meetings=consecutive,
    )
