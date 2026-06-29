from datetime import datetime

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.email_service import (
    send_prep_task_due_soon_email,
    send_volunteer_task_assigned_email,
    send_welcome_email,
)
from app.services.prep_task_reminder_store import record_due_soon_reminder


@celery_app.task(name="email.send_welcome")
def send_welcome_email_task(email: str, full_name: str) -> None:
    send_welcome_email(email=email, full_name=full_name)


@celery_app.task(name="email.send_prep_task_due_soon")
def send_prep_task_due_soon_email_task(
    event_task_id: int,
    assignee_id: int,
    email: str,
    full_name: str,
    event_title: str,
    group_name: str,
    due_date_iso: str,
) -> None:
    sent = send_prep_task_due_soon_email(
        email=email,
        full_name=full_name,
        event_title=event_title,
        group_name=group_name,
        due_date=datetime.fromisoformat(due_date_iso),
    )
    if not sent:
        return

    db = SessionLocal()
    try:
        record_due_soon_reminder(
            db,
            event_task_id=event_task_id,
            assignee_id=assignee_id,
            recipient_email=email,
        )
    finally:
        db.close()


@celery_app.task(name="email.send_volunteer_task_assigned")
def send_volunteer_task_assigned_email_task(
    email: str,
    full_name: str,
    task_name: str,
    event_title: str,
    event_starts_at_iso: str,
) -> None:
    send_volunteer_task_assigned_email(
        email=email,
        full_name=full_name,
        task_name=task_name,
        event_title=event_title,
        event_starts_at=datetime.fromisoformat(event_starts_at_iso),
    )
