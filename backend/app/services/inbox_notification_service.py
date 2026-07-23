from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_volunteer_signup import EventVolunteerSignup
from app.models.inbox_notification import InboxNotification, InboxNotificationType
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.schemas.inbox_notification import (
    InboxNotificationListResponse,
    InboxNotificationResponse,
    MarkAllInboxReadResponse,
    MarkInboxReadResponse,
)
from app.services.organization_context import get_default_organization_id


class InboxNotificationNotFoundError(Exception):
    pass


def _approved_recipients(db: Session) -> list[Member]:
    return list(
        db.scalars(
            select(Member).where(Member.status == MemberStatus.APPROVED)
        ).all()
    )


def _board_recipients(db: Session) -> list[Member]:
    return list(
        db.scalars(
            select(Member).where(
                Member.status == MemberStatus.APPROVED,
                Member.role.in_(
                    (
                        MemberRole.BOARD,
                        MemberRole.TREASURER,
                        MemberRole.PRESIDENT,
                    )
                ),
            )
        ).all()
    )


def _role_recipients(db: Session, role: MemberRole) -> list[Member]:
    return list(
        db.scalars(
            select(Member).where(
                Member.status == MemberStatus.APPROVED,
                Member.role == role,
            )
        ).all()
    )


def _task_manager_recipients(db: Session) -> list[Member]:
    """President (role) or VP / Event Manager (position)."""
    return list(
        db.scalars(
            select(Member).where(
                Member.status == MemberStatus.APPROVED,
                or_(
                    Member.role == MemberRole.PRESIDENT,
                    Member.position.in_(
                        (
                            MemberPosition.VICE_PRESIDENT,
                            MemberPosition.EVENT_MANAGER,
                        )
                    ),
                ),
            )
        ).all()
    )


def create_inbox_notification(
    db: Session,
    *,
    member_id: int,
    type: InboxNotificationType | str,
    title: str,
    body: str | None = None,
    href: str | None = None,
    dedupe_key: str | None = None,
    commit: bool = True,
) -> InboxNotification | None:
    """Create an inbox row. Returns None when a dedupe_key already exists."""
    if dedupe_key is not None:
        existing = db.scalar(
            select(InboxNotification.id).where(
                InboxNotification.member_id == member_id,
                InboxNotification.dedupe_key == dedupe_key,
            )
        )
        if existing is not None:
            return None

    notification = InboxNotification(
        member_id=member_id,
        type=type.value if isinstance(type, InboxNotificationType) else type,
        title=title,
        body=body,
        href=href,
        dedupe_key=dedupe_key,
        organization_id=get_default_organization_id(db),
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    else:
        db.flush()
    return notification


def notify_many(
    db: Session,
    *,
    recipients: list[Member],
    type: InboxNotificationType,
    title: str,
    body: str | None = None,
    href: str | None = None,
    dedupe_key_for: Callable[[Member], str] | None = None,
) -> int:
    created = 0
    for recipient in recipients:
        dedupe_key = dedupe_key_for(recipient) if dedupe_key_for else None
        row = create_inbox_notification(
            db,
            member_id=recipient.id,
            type=type,
            title=title,
            body=body,
            href=href,
            dedupe_key=dedupe_key,
            commit=False,
        )
        if row is not None:
            created += 1
    if created:
        db.commit()
    return created


def notify_board_of_pending_member(db: Session, *, pending_member: Member) -> int:
    recipients = [m for m in _board_recipients(db) if m.id != pending_member.id]
    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.MEMBER_PENDING,
        title=f"{pending_member.full_name} requested membership",
        body="Review and approve or reject this pending member.",
        href="/members?tab=pending",
        dedupe_key_for=lambda recipient: (
            f"member_pending:{pending_member.id}:{recipient.id}"
        ),
    )


def notify_member_approved(db: Session, *, member: Member) -> InboxNotification | None:
    return create_inbox_notification(
        db,
        member_id=member.id,
        type=InboxNotificationType.MEMBER_APPROVED,
        title="Your membership was approved",
        body="You now have full access to NSA Connect.",
        href="/",
        dedupe_key=f"member_approved:{member.id}",
    )


def notify_finance_change_pending(
    db: Session,
    *,
    request_id: int,
    requester: Member,
    action_label: str,
) -> int:
    if requester.role == MemberRole.TREASURER:
        recipients = _role_recipients(db, MemberRole.PRESIDENT)
    elif requester.role == MemberRole.PRESIDENT:
        recipients = _role_recipients(db, MemberRole.TREASURER)
    else:
        return 0

    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.FINANCE_CHANGE_PENDING,
        title=f"Budget change needs review",
        body=f"{requester.full_name} submitted a finance {action_label}.",
        href="/finance?tab=approvals",
        dedupe_key_for=lambda recipient: (
            f"finance_change_pending:{request_id}:{recipient.id}"
        ),
    )


def notify_finance_change_resolved(
    db: Session,
    *,
    request_id: int,
    requester_id: int,
    approved: bool,
    reviewer_name: str,
) -> InboxNotification | None:
    verb = "approved" if approved else "rejected"
    return create_inbox_notification(
        db,
        member_id=requester_id,
        type=InboxNotificationType.FINANCE_CHANGE_RESOLVED,
        title=f"Budget change {verb}",
        body=f"{reviewer_name} {verb} your finance change request.",
        href="/finance?tab=approvals",
        dedupe_key=f"finance_change_resolved:{request_id}:{verb}",
    )


def notify_board_of_suggestion(
    db: Session,
    *,
    suggestion_id: int,
    title: str,
    suggested_by: Member,
) -> int:
    recipients = [m for m in _board_recipients(db) if m.id != suggested_by.id]
    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.SUGGESTION_SUBMITTED,
        title=f"New event suggestion: {title}",
        body=f"Submitted by {suggested_by.full_name}.",
        href="/events/suggestions",
        dedupe_key_for=lambda recipient: (
            f"suggestion_submitted:{suggestion_id}:{recipient.id}"
        ),
    )


def notify_suggestion_noted(
    db: Session,
    *,
    suggestion_id: int,
    suggested_by_id: int,
    title: str,
) -> InboxNotification | None:
    return create_inbox_notification(
        db,
        member_id=suggested_by_id,
        type=InboxNotificationType.SUGGESTION_NOTED,
        title=f"Your suggestion was noted: {title}",
        body="The board marked your event suggestion as noted.",
        href="/events/suggestions",
        dedupe_key=f"suggestion_noted:{suggestion_id}",
    )


def notify_task_assigned_inbox(
    db: Session,
    *,
    task_id: int,
    assignee_id: int,
    task_title: str,
    event_title: str | None,
    assigner_name: str | None = None,
) -> InboxNotification | None:
    who = assigner_name.strip() if assigner_name else None
    detail = f" for {event_title}" if event_title else ""
    body = (
        f"{who} assigned you a task{detail}."
        if who
        else f"You were assigned a task{detail}."
    )
    return create_inbox_notification(
        db,
        member_id=assignee_id,
        type=InboxNotificationType.TASK_ASSIGNED,
        title=f"New task: {task_title}",
        body=body,
        href="/events/tasks",
        dedupe_key=f"task_assigned:{task_id}:{assignee_id}",
    )


def notify_task_due_inbox(
    db: Session,
    *,
    task_id: int,
    assignee_id: int,
    task_title: str,
    event_title: str | None,
) -> InboxNotification | None:
    detail = f" for {event_title}" if event_title else ""
    return create_inbox_notification(
        db,
        member_id=assignee_id,
        type=InboxNotificationType.TASK_DUE_REMINDER,
        title=f"Task due soon: {task_title}",
        body=f"Your task{detail} is due within about a day.",
        href="/events/tasks",
        dedupe_key=f"task_due:{task_id}:{assignee_id}",
    )


def notify_task_managers_of_volunteer_signup(
    db: Session,
    *,
    event: Event,
    volunteer: Member,
    signup_id: int,
) -> int:
    # Prefer task managers; fall back to board so someone always sees the request.
    recipients = [m for m in _task_manager_recipients(db) if m.id != volunteer.id]
    if not recipients:
        recipients = [m for m in _board_recipients(db) if m.id != volunteer.id]
    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.VOLUNTEER_SIGNUP,
        title=f"{volunteer.full_name} requested to volunteer",
        body=f"Review their volunteer request for {event.title}.",
        href=f"/events/{event.id}/manage?modal=volunteers",
        dedupe_key_for=lambda recipient: (
            f"volunteer_signup:{signup_id}:{recipient.id}"
        ),
    )


def notify_members_of_volunteer_invite(
    db: Session,
    *,
    event: Event,
    member_ids: list[int],
    inviter: Member,
) -> int:
    recipients = [
        member
        for member in db.scalars(
            select(Member).where(
                Member.id.in_(member_ids),
                Member.status == MemberStatus.APPROVED,
            )
        ).all()
        if member.id != inviter.id
    ]
    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.VOLUNTEER_INVITE,
        title=f"You're invited to volunteer for {event.title}",
        body=f"{inviter.full_name} asked you to help with {event.title}.",
        href=f"/events/{event.id}?volunteer=1",
        dedupe_key_for=lambda recipient: (
            f"volunteer_invite:{event.id}:{recipient.id}"
        ),
    )


def notify_volunteer_signup_reviewed(
    db: Session,
    *,
    event: Event,
    signup: EventVolunteerSignup,
    approved: bool,
) -> InboxNotification | None:
    if approved:
        title = f"Volunteer request approved for {event.title}"
        body = "You can now be assigned tasks for this event."
    else:
        title = f"Volunteer request declined for {event.title}"
        body = "Organizers declined this volunteer request."
    return create_inbox_notification(
        db,
        member_id=signup.member_id,
        type=InboxNotificationType.VOLUNTEER_SIGNUP_REVIEWED,
        title=title,
        body=body,
        href=f"/events/{event.id}",
        dedupe_key=f"volunteer_reviewed:{signup.id}:{signup.status.value}",
    )


def notify_announcement_published(
    db: Session,
    *,
    announcement_id: int,
    title: str,
    author: Member,
    category_label: str | None = None,
    announcement=None,
) -> int:
    if announcement is not None:
        from app.services.announcement_recipients import list_announcement_recipients

        recipients = [
            member
            for member in list_announcement_recipients(db, announcement)
            if member.id != author.id
        ]
    else:
        recipients = [m for m in _approved_recipients(db) if m.id != author.id]
    category = category_label or "Announcement"
    return notify_many(
        db,
        recipients=recipients,
        type=InboxNotificationType.ANNOUNCEMENT,
        title=title,
        body=f"{category} from {author.full_name}",
        href="/announcements",
        dedupe_key_for=lambda recipient: (
            f"announcement:{announcement_id}:{recipient.id}"
        ),
    )


def list_inbox_notifications(
    db: Session,
    *,
    member_id: int,
    limit: int = 50,
) -> InboxNotificationListResponse:
    notifications = list(
        db.scalars(
            select(InboxNotification)
            .where(InboxNotification.member_id == member_id)
            .order_by(
                InboxNotification.created_at.desc(),
                InboxNotification.id.desc(),
            )
            .limit(limit)
        ).all()
    )
    unread_count = (
        db.scalar(
            select(func.count())
            .select_from(InboxNotification)
            .where(
                InboxNotification.member_id == member_id,
                InboxNotification.read_at.is_(None),
            )
        )
        or 0
    )
    total = (
        db.scalar(
            select(func.count())
            .select_from(InboxNotification)
            .where(InboxNotification.member_id == member_id)
        )
        or 0
    )
    return InboxNotificationListResponse(
        notifications=[
            InboxNotificationResponse.from_orm_notification(item)
            for item in notifications
        ],
        total=total,
        unread_count=unread_count,
    )


def mark_inbox_notification_read(
    db: Session,
    *,
    member_id: int,
    notification_id: int,
) -> MarkInboxReadResponse:
    notification = db.scalar(
        select(InboxNotification).where(
            InboxNotification.id == notification_id,
            InboxNotification.member_id == member_id,
        )
    )
    if notification is None:
        raise InboxNotificationNotFoundError

    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(notification)

    assert notification.read_at is not None
    return MarkInboxReadResponse(
        id=notification.id,
        read_at=notification.read_at,
        unread=False,
    )


def mark_all_inbox_notifications_read(
    db: Session,
    *,
    member_id: int,
) -> MarkAllInboxReadResponse:
    now = datetime.now(UTC)
    unread = list(
        db.scalars(
            select(InboxNotification).where(
                InboxNotification.member_id == member_id,
                InboxNotification.read_at.is_(None),
            )
        ).all()
    )
    for notification in unread:
        notification.read_at = now
    if unread:
        db.commit()
    return MarkAllInboxReadResponse(marked_count=len(unread), read_at=now)
