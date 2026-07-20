"""
Bulk member engagement for directory KPIs.

Active = approved member with any recent positive signal:
  - event check-in in the activity window
  - current-semester dues paid or exempt
  - task completed in the window, or currently in progress
  - event suggestion submitted in the window

Idle = approved member with none of the above.
Pending / rejected members are excluded from these counts.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.lib.semester import get_current_semester_slug
from app.models.event_checkin import EventCheckIn
from app.models.event_suggestion import EventSuggestion
from app.models.event_task import EventTask, EventTaskStatus
from app.models.member import Member, MemberStatus
from app.models.member_dues import MemberDues
from app.schemas.member_engagement import (
    MemberEngagementEntry,
    MemberEngagementSignals,
    MemberEngagementStatus,
    MembersEngagementResponse,
)

DEFAULT_ENGAGEMENT_WINDOW_DAYS = 90


def _dues_is_paid_or_exempt(record: MemberDues) -> bool:
    owed = float(record.amount_owed or 0)
    paid = float(record.amount_paid or 0)
    if owed <= 0:
        return True
    return paid >= owed


def build_members_engagement(
    db: Session,
    *,
    window_days: int = DEFAULT_ENGAGEMENT_WINDOW_DAYS,
    as_of: datetime | None = None,
) -> MembersEngagementResponse:
    now = as_of or datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

    window_start = now - timedelta(days=window_days)
    semester = get_current_semester_slug(now)

    approved_ids = list(
        db.scalars(
            select(Member.id).where(Member.status == MemberStatus.APPROVED)
        ).all()
    )

    if not approved_ids:
        return MembersEngagementResponse(
            semester=semester,
            window_days=window_days,
            active_count=0,
            idle_count=0,
            members=[],
        )

    checkin_ids = set(
        db.scalars(
            select(EventCheckIn.member_id)
            .where(
                EventCheckIn.member_id.in_(approved_ids),
                EventCheckIn.checked_in_at >= window_start,
            )
            .distinct()
        ).all()
    )

    dues_rows = db.scalars(
        select(MemberDues).where(
            MemberDues.member_id.in_(approved_ids),
            MemberDues.semester == semester,
        )
    ).all()
    dues_ids = {
        row.member_id for row in dues_rows if _dues_is_paid_or_exempt(row)
    }

    completed_task_ids = set(
        db.scalars(
            select(EventTask.assignee_id)
            .where(
                EventTask.assignee_id.in_(approved_ids),
                EventTask.completed_at.is_not(None),
                EventTask.completed_at >= window_start,
            )
            .distinct()
        ).all()
    )

    in_progress_task_ids = set(
        db.scalars(
            select(EventTask.assignee_id)
            .where(
                EventTask.assignee_id.in_(approved_ids),
                EventTask.status == EventTaskStatus.IN_PROGRESS,
            )
            .distinct()
        ).all()
    )

    suggestion_ids = set(
        db.scalars(
            select(EventSuggestion.suggested_by_id)
            .where(
                EventSuggestion.suggested_by_id.in_(approved_ids),
                EventSuggestion.created_at >= window_start,
            )
            .distinct()
        ).all()
    )

    entries: list[MemberEngagementEntry] = []
    active_count = 0
    idle_count = 0

    for member_id in approved_ids:
        signals = MemberEngagementSignals(
            attended_event=member_id in checkin_ids,
            paid_dues=member_id in dues_ids,
            completed_task=member_id in completed_task_ids,
            in_progress_task=member_id in in_progress_task_ids,
            shared_suggestion=member_id in suggestion_ids,
        )
        is_active = any(
            (
                signals.attended_event,
                signals.paid_dues,
                signals.completed_task,
                signals.in_progress_task,
                signals.shared_suggestion,
            )
        )
        status = (
            MemberEngagementStatus.ACTIVE
            if is_active
            else MemberEngagementStatus.IDLE
        )
        if is_active:
            active_count += 1
        else:
            idle_count += 1

        entries.append(
            MemberEngagementEntry(
                member_id=member_id,
                status=status,
                signals=signals,
            )
        )

    entries.sort(key=lambda entry: entry.member_id)

    return MembersEngagementResponse(
        semester=semester,
        window_days=window_days,
        active_count=active_count,
        idle_count=idle_count,
        members=entries,
    )
