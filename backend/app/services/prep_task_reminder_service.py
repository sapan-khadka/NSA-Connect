import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.event_task import EventTask, EventTaskKind
from app.models.member import Member
from app.services.prep_task_reminder_store import due_soon_reminder_exists

logger = logging.getLogger(__name__)


def list_incomplete_checklist_tasks_due_within(
    db: Session,
    *,
    days: int | None = None,
    as_of: datetime | None = None,
) -> list[EventTask]:
    window_days = days if days is not None else settings.PREP_TASK_DUE_SOON_DAYS
    now = as_of or datetime.now(UTC)
    window_end = now + timedelta(days=window_days)

    tasks = list(
        db.scalars(
            select(EventTask)
            .where(EventTask.task_kind == EventTaskKind.CHECKLIST)
            .where(EventTask.due_date >= now)
            .where(EventTask.due_date <= window_end)
            .options(
                selectinload(EventTask.checklist_items),
                selectinload(EventTask.group),
                selectinload(EventTask.event),
            )
            .order_by(EventTask.due_date),
        ).all(),
    )
    return [task for task in tasks if not task.is_checklist_complete]


def scan_and_notify_prep_tasks_due_soon(
    db: Session,
    *,
    as_of: datetime | None = None,
) -> dict[str, int]:
    from app.tasks.email_tasks import send_prep_task_due_soon_email_task

    due_soon_tasks = list_incomplete_checklist_tasks_due_within(db, as_of=as_of)
    emails_queued = 0
    skipped_unassigned = 0
    skipped_already_sent = 0

    for task in due_soon_tasks:
        if task.assignee_id is None:
            skipped_unassigned += 1
            logger.info(
                "Checklist task due soon with no assignee task_id=%s event_id=%s title=%s due=%s",
                task.id,
                task.event_id,
                task.title,
                task.due_date.isoformat(),
            )
            continue

        assignee = db.get(Member, task.assignee_id)
        if assignee is None:
            skipped_unassigned += 1
            logger.warning(
                "Checklist task assignee missing task_id=%s assignee_id=%s",
                task.id,
                task.assignee_id,
            )
            continue

        if due_soon_reminder_exists(
            db,
            event_task_id=task.id,
            assignee_id=assignee.id,
        ):
            skipped_already_sent += 1
            logger.info(
                "Checklist task due-soon reminder already sent task_id=%s assignee_id=%s",
                task.id,
                assignee.id,
            )
            continue

        send_prep_task_due_soon_email_task.delay(
            event_task_id=task.id,
            assignee_id=assignee.id,
            email=assignee.email,
            full_name=assignee.full_name,
            event_title=task.event.title,
            group_name=task.title,
            due_date_iso=task.due_date.isoformat(),
        )
        emails_queued += 1

    logger.info(
        "Checklist task due-soon scan complete scanned=%s emails_queued=%s "
        "skipped_unassigned=%s skipped_already_sent=%s",
        len(due_soon_tasks),
        emails_queued,
        skipped_unassigned,
        skipped_already_sent,
    )
    return {
        "scanned": len(due_soon_tasks),
        "emails_queued": emails_queued,
        "skipped_unassigned": skipped_unassigned,
        "skipped_already_sent": skipped_already_sent,
    }
