from datetime import UTC, datetime

from app.core.config import settings
from app.integrations.resend_client import ResendDeliveryError
from app.models.event_rsvp import RsvpStatus
from app.services.resend_email_service import send_resend_email


def _frontend_base_url() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def build_event_url(event_id: int) -> str:
    return f"{_frontend_base_url()}/events/{event_id}"


def build_tasks_url() -> str:
    return f"{_frontend_base_url()}/events/tasks"


def build_profile_url() -> str:
    return f"{_frontend_base_url()}/profile"


def build_announcements_url() -> str:
    return f"{_frontend_base_url()}/announcements"


def format_currency_amount(amount) -> str:
    return f"${float(amount):,.2f}"


def format_event_datetime(value: datetime) -> str:
    dt = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    hour = dt.strftime("%I").lstrip("0") or "12"
    return (
        f"{dt.strftime('%A, %B')} {dt.day}, {dt.year} at "
        f"{hour}:{dt.strftime('%M %p')} UTC"
    )


def format_due_date(value: datetime) -> str:
    dt = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    return f"{dt.strftime('%A, %B')} {dt.day}, {dt.year}"


def _rsvp_label(status: RsvpStatus) -> str:
    if status == RsvpStatus.GOING:
        return "Going"
    if status == RsvpStatus.MAYBE:
        return "Maybe"
    return status.value.replace("_", " ").title()


def send_event_reminder_email(
    *,
    to_email: str,
    full_name: str,
    event_title: str,
    event_starts_at: datetime,
    rsvp_status: RsvpStatus,
    event_id: int,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        f"Reminder: {event_title} is tomorrow.\n\n"
        f"When: {format_event_datetime(event_starts_at)}\n"
        f"Your RSVP: {_rsvp_label(rsvp_status)}\n\n"
        f"View event: {build_event_url(event_id)}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"Reminder: {event_title} is tomorrow",
        body=body,
    )


def send_rsvp_nudge_email(
    *,
    to_email: str,
    full_name: str,
    event_title: str,
    event_starts_at: datetime,
    event_id: int,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        f"{event_title} is in two days and we haven't received your RSVP yet.\n\n"
        f"When: {format_event_datetime(event_starts_at)}\n\n"
        f"Please RSVP: {build_event_url(event_id)}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"RSVP requested: {event_title}",
        body=body,
    )


def send_task_assigned_email(
    *,
    to_email: str,
    full_name: str,
    task_title: str,
    event_title: str | None,
    due_date: datetime | None,
    task_id: int,
) -> str:
    due_line = (
        f"Due: {format_due_date(due_date)}\n"
        if due_date is not None
        else "Due date: not set\n"
    )
    event_line = f"Event: {event_title}\n" if event_title else ""
    body = (
        f"Hi {full_name},\n\n"
        f"You've been assigned a task: {task_title}\n\n"
        f"{event_line}"
        f"{due_line}\n"
        f"View tasks: {build_tasks_url()}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"Task assigned: {task_title}",
        body=body,
    )


def send_task_due_reminder_email(
    *,
    to_email: str,
    full_name: str,
    task_title: str,
    due_date: datetime,
    event_title: str | None,
    task_id: int,
) -> str:
    event_line = f"Event: {event_title}\n" if event_title else ""
    body = (
        f"Hi {full_name},\n\n"
        f"Reminder: {task_title} is due tomorrow.\n\n"
        f"{event_line}"
        f"Due: {format_due_date(due_date)}\n\n"
        f"View tasks: {build_tasks_url()}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"Due tomorrow: {task_title}",
        body=body,
    )


def send_dues_reminder_email(
    *,
    to_email: str,
    full_name: str,
    semester: str,
    amount_outstanding,
) -> str:
    from app.lib.semester import format_semester_label

    semester_label = format_semester_label(semester)
    amount_label = format_currency_amount(amount_outstanding)
    body = (
        f"Hi {full_name},\n\n"
        f"Friendly reminder: you have {amount_label} in membership dues "
        f"outstanding for {semester_label}.\n\n"
        "When you're ready to pay, contact the NSA treasurer — Venmo and cash "
        "are both accepted.\n\n"
        f"View your profile: {build_profile_url()}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"Dues reminder: {semester_label}",
        body=body,
    )


def send_announcement_email(
    *,
    to_email: str,
    full_name: str,
    announcement_title: str,
    announcement_body: str,
    author_name: str,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        f"New announcement from {author_name}:\n\n"
        f"{announcement_title}\n\n"
        f"{announcement_body}\n\n"
        f"View all announcements: {build_announcements_url()}\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=f"Announcement: {announcement_title}",
        body=body,
    )


def deliver_notification_email(
    *,
    send_callable,
) -> tuple[bool, str | None]:
    try:
        send_callable()
        return True, None
    except ResendDeliveryError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, str(exc)
