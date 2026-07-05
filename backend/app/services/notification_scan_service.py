import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.lib.semester import get_current_semester_slug
from app.models.event import Event
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.event_task import EventTask, EventTaskKind, EventTaskStatus
from app.models.member import Member, MemberStatus
from app.models.member_dues import DuesStatus, MemberDues
from app.models.notification_sent_log import NotificationType
from app.services.notification_email_service import (
    deliver_notification_email,
    send_dues_reminder_email,
    send_event_reminder_email,
    send_rsvp_nudge_email,
    send_task_assigned_email,
    send_task_due_reminder_email,
)
from app.services.notification_sent_store import (
    record_notification_send,
    scheduled_notification_already_sent,
)

logger = logging.getLogger(__name__)

EVENT_REMINDER_WINDOW = (timedelta(hours=23), timedelta(hours=25))
RSVP_NUDGE_WINDOW = (timedelta(hours=47), timedelta(hours=49))
TASK_DUE_WINDOW = (timedelta(hours=23), timedelta(hours=25))

EVENT_REMINDER_RSVP_STATUSES = (RsvpStatus.GOING, RsvpStatus.MAYBE)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _window_bounds(
    as_of: datetime,
    window: tuple[timedelta, timedelta],
) -> tuple[datetime, datetime]:
    return as_of + window[0], as_of + window[1]


def _is_task_complete(task: EventTask) -> bool:
    if task.task_kind == EventTaskKind.CHECKLIST:
        return task.is_checklist_complete
    return task.status == EventTaskStatus.DONE


def _member_prefers(db: Session, member: Member, notification_type: NotificationType) -> bool:
    if notification_type == NotificationType.EVENT_REMINDER:
        return member.notify_event_reminders
    if notification_type == NotificationType.RSVP_NUDGE:
        return member.notify_rsvp_nudges
    if notification_type == NotificationType.DUES_REMINDER:
        return member.notify_dues_reminders
    return member.notify_task_reminders


def _send_and_log(
    db: Session,
    *,
    member: Member,
    notification_type: NotificationType,
    event_id: int | None,
    event_task_id: int | None,
    send_callable,
    semester: str | None = None,
) -> bool:
    try:
        success, error_message = deliver_notification_email(send_callable=send_callable)
        record_notification_send(
            db,
            member=member,
            notification_type=notification_type,
            success=success,
            event_id=event_id,
            event_task_id=event_task_id,
            semester=semester,
            error_message=error_message,
        )
        return success
    except Exception:
        logger.exception(
            "Unexpected error sending notification type=%s member_id=%s email=%s "
            "event_id=%s event_task_id=%s semester=%s",
            notification_type.value,
            member.id,
            member.email,
            event_id,
            event_task_id,
            semester,
        )
        return False


def notify_task_assigned_if_enabled(
    db: Session,
    *,
    task: EventTask,
    assignee: Member,
) -> bool:
    if not assignee.notify_task_reminders:
        logger.info(
            "Skipping task assigned notification — preference off member_id=%s task_id=%s",
            assignee.id,
            task.id,
        )
        return False

    event_title = task.event.title if task.event else None

    def _send() -> None:
        send_task_assigned_email(
            to_email=assignee.email,
            full_name=assignee.full_name,
            task_title=task.title,
            event_title=event_title,
            due_date=task.due_date,
            task_id=task.id,
        )

    return _send_and_log(
        db,
        member=assignee,
        notification_type=NotificationType.TASK_ASSIGNED,
        event_id=None,
        event_task_id=task.id,
        send_callable=_send,
    )


def _process_event_reminders(db: Session, *, as_of: datetime) -> dict[str, int]:
    window_start, window_end = _window_bounds(as_of, EVENT_REMINDER_WINDOW)
    stats = {"candidates": 0, "sent": 0, "skipped": 0}

    events = list(
        db.scalars(
            select(Event)
            .where(Event.starts_at >= window_start)
            .where(Event.starts_at < window_end)
            .options(selectinload(Event.rsvps).selectinload(EventRsvp.member)),
        ).all(),
    )

    for event in events:
        for rsvp in event.rsvps:
            if rsvp.status not in EVENT_REMINDER_RSVP_STATUSES:
                continue

            member = rsvp.member
            if member is None or member.status != MemberStatus.APPROVED:
                continue

            stats["candidates"] += 1

            if not _member_prefers(db, member, NotificationType.EVENT_REMINDER):
                stats["skipped"] += 1
                continue

            if scheduled_notification_already_sent(
                db,
                member_id=member.id,
                notification_type=NotificationType.EVENT_REMINDER,
                event_id=event.id,
            ):
                stats["skipped"] += 1
                continue

            def _send(
                member=member,
                event=event,
                rsvp=rsvp,
            ) -> None:
                send_event_reminder_email(
                    to_email=member.email,
                    full_name=member.full_name,
                    event_title=event.title,
                    event_starts_at=event.starts_at,
                    rsvp_status=rsvp.status,
                    event_id=event.id,
                )

            if _send_and_log(
                db,
                member=member,
                notification_type=NotificationType.EVENT_REMINDER,
                event_id=event.id,
                event_task_id=None,
                send_callable=_send,
            ):
                stats["sent"] += 1
            else:
                stats["skipped"] += 1

    return stats


def _process_rsvp_nudges(db: Session, *, as_of: datetime) -> dict[str, int]:
    window_start, window_end = _window_bounds(as_of, RSVP_NUDGE_WINDOW)
    stats = {"candidates": 0, "sent": 0, "skipped": 0}

    events = list(
        db.scalars(
            select(Event)
            .where(Event.starts_at >= window_start)
            .where(Event.starts_at < window_end),
        ).all(),
    )

    if not events:
        return stats

    approved_members = list(
        db.scalars(
            select(Member).where(Member.status == MemberStatus.APPROVED),
        ).all(),
    )

    for event in events:
        responded_member_ids = set(
            db.scalars(
                select(EventRsvp.member_id).where(EventRsvp.event_id == event.id),
            ).all(),
        )

        for member in approved_members:
            if member.id in responded_member_ids:
                continue

            stats["candidates"] += 1

            if not _member_prefers(db, member, NotificationType.RSVP_NUDGE):
                stats["skipped"] += 1
                continue

            if scheduled_notification_already_sent(
                db,
                member_id=member.id,
                notification_type=NotificationType.RSVP_NUDGE,
                event_id=event.id,
            ):
                stats["skipped"] += 1
                continue

            def _send(member=member, event=event) -> None:
                send_rsvp_nudge_email(
                    to_email=member.email,
                    full_name=member.full_name,
                    event_title=event.title,
                    event_starts_at=event.starts_at,
                    event_id=event.id,
                )

            if _send_and_log(
                db,
                member=member,
                notification_type=NotificationType.RSVP_NUDGE,
                event_id=event.id,
                event_task_id=None,
                send_callable=_send,
            ):
                stats["sent"] += 1
            else:
                stats["skipped"] += 1

    return stats


def _process_task_due_reminders(db: Session, *, as_of: datetime) -> dict[str, int]:
    window_start, window_end = _window_bounds(as_of, TASK_DUE_WINDOW)
    stats = {"candidates": 0, "sent": 0, "skipped": 0}

    tasks = list(
        db.scalars(
            select(EventTask)
            .where(EventTask.due_date.is_not(None))
            .where(EventTask.due_date >= window_start)
            .where(EventTask.due_date < window_end)
            .where(EventTask.assignee_id.is_not(None))
            .options(
                selectinload(EventTask.event),
                selectinload(EventTask.checklist_items),
                selectinload(EventTask.assignee),
            ),
        ).all(),
    )

    for task in tasks:
        if _is_task_complete(task):
            continue

        assignee = task.assignee
        if assignee is None or assignee.status != MemberStatus.APPROVED:
            continue

        stats["candidates"] += 1

        if not _member_prefers(db, assignee, NotificationType.TASK_DUE_REMINDER):
            stats["skipped"] += 1
            continue

        if scheduled_notification_already_sent(
            db,
            member_id=assignee.id,
            notification_type=NotificationType.TASK_DUE_REMINDER,
            event_task_id=task.id,
        ):
            stats["skipped"] += 1
            continue

        event_title = task.event.title if task.event else None
        assert task.due_date is not None

        def _send(task=task, assignee=assignee, event_title=event_title) -> None:
            send_task_due_reminder_email(
                to_email=assignee.email,
                full_name=assignee.full_name,
                task_title=task.title,
                due_date=task.due_date,
                event_title=event_title,
                task_id=task.id,
            )

        if _send_and_log(
            db,
            member=assignee,
            notification_type=NotificationType.TASK_DUE_REMINDER,
            event_id=None,
            event_task_id=task.id,
            send_callable=_send,
        ):
            stats["sent"] += 1
        else:
            stats["skipped"] += 1

    return stats


def _process_dues_reminders(db: Session, *, as_of: datetime) -> dict[str, int]:
    semester = get_current_semester_slug(as_of)
    stats = {"candidates": 0, "sent": 0, "skipped": 0}

    records = list(
        db.scalars(
            select(MemberDues)
            .options(selectinload(MemberDues.member))
            .where(MemberDues.semester == semester),
        ).all(),
    )

    for record in records:
        status = MemberDues.compute_status(record.amount_owed, record.amount_paid)
        if status not in {DuesStatus.UNPAID, DuesStatus.PARTIAL}:
            continue

        member = record.member
        if member is None or member.status != MemberStatus.APPROVED:
            continue

        stats["candidates"] += 1

        if not _member_prefers(db, member, NotificationType.DUES_REMINDER):
            stats["skipped"] += 1
            continue

        if scheduled_notification_already_sent(
            db,
            member_id=member.id,
            notification_type=NotificationType.DUES_REMINDER,
            semester=semester,
        ):
            stats["skipped"] += 1
            continue

        amount_outstanding = Decimal(record.amount_owed) - Decimal(record.amount_paid)

        def _send(
            member=member,
            semester=semester,
            amount_outstanding=amount_outstanding,
        ) -> None:
            send_dues_reminder_email(
                to_email=member.email,
                full_name=member.full_name,
                semester=semester,
                amount_outstanding=amount_outstanding,
            )

        if _send_and_log(
            db,
            member=member,
            notification_type=NotificationType.DUES_REMINDER,
            event_id=None,
            event_task_id=None,
            semester=semester,
            send_callable=_send,
        ):
            stats["sent"] += 1
        else:
            stats["skipped"] += 1

    return stats


def run_scheduled_notification_checks(
    db: Session,
    *,
    as_of: datetime | None = None,
) -> dict[str, object]:
    now = _as_utc(as_of or datetime.now(UTC))

    event_stats = _process_event_reminders(db, as_of=now)
    rsvp_stats = _process_rsvp_nudges(db, as_of=now)
    task_stats = _process_task_due_reminders(db, as_of=now)
    dues_stats = _process_dues_reminders(db, as_of=now)

    summary = {
        "checked_at": now.isoformat(),
        "event_reminders": event_stats,
        "rsvp_nudges": rsvp_stats,
        "task_due_reminders": task_stats,
        "dues_reminders": dues_stats,
    }
    logger.info("Scheduled notification check complete summary=%s", summary)
    return summary
