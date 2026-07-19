from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.event_task import EventTask
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.schemas.notification_summary import NotificationSummaryResponse
from app.services.discussion_inbox_service import list_discussion_inbox
from app.services.event_task_service import list_my_event_tasks
from app.services.finance_change_request_service import list_pending_for_reviewer
from app.services.member_service import list_members_by_status


def _is_treasury_writer(member: Member) -> bool:
    if member.has_role_at_least(MemberRole.TREASURER):
        return True
    return member.position == MemberPosition.VICE_PRESIDENT


def _is_due_today(task: EventTask, now: datetime) -> bool:
    if task.due_date is None:
        return False
    due = task.due_date
    if due.tzinfo is None:
        due = due.replace(tzinfo=UTC)
    return due.astimezone(UTC).date() == now.astimezone(UTC).date()


def get_notification_summary(
    db: Session,
    member: Member,
) -> NotificationSummaryResponse:
    members_pending = 0
    finance_pending = 0
    suggestions_pending = 0

    if member.has_role_at_least(MemberRole.BOARD):
        members_pending = len(list_members_by_status(db, MemberStatus.PENDING))
        suggestions_pending = (
            db.scalar(
                select(func.count())
                .select_from(EventSuggestion)
                .where(EventSuggestion.status == EventSuggestionStatus.SUBMITTED),
            )
            or 0
        )

    if _is_treasury_writer(member):
        finance_pending = len(list_pending_for_reviewer(db, member))

    discussions_unread = sum(
        room.unread_count for room in list_discussion_inbox(db, member=member)
    )

    now = datetime.now(UTC)
    my_tasks = list_my_event_tasks(db, member.id)
    open_tasks = [task for task in my_tasks if not task.is_checklist_complete]
    tasks_overdue = sum(1 for task in open_tasks if task.is_overdue)
    tasks_due_today = sum(
        1
        for task in open_tasks
        if not task.is_overdue and _is_due_today(task, now)
    )

    attention_total = (
        members_pending
        + finance_pending
        + suggestions_pending
        + discussions_unread
        + tasks_overdue
        + tasks_due_today
    )

    return NotificationSummaryResponse(
        members_pending=members_pending,
        finance_pending=finance_pending,
        suggestions_pending=suggestions_pending,
        discussions_unread=discussions_unread,
        tasks_overdue=tasks_overdue,
        tasks_due_today=tasks_due_today,
        attention_total=attention_total,
    )
