import logging
from datetime import UTC, datetime

from app.core.config import settings
from app.integrations.sendgrid_client import SendGridDeliveryError, send_email

logger = logging.getLogger(__name__)

WELCOME_EMAIL_SUBJECT = "Welcome to NSA Connect"
PREP_TASK_DUE_SOON_SUBJECT = "Prep task due soon: {group_name}"
VOLUNTEER_TASK_ASSIGNED_SUBJECT = "Volunteer task assigned: {task_name}"
MEETING_ATTENDANCE_RECORDED_SUBJECT = "Board meeting attendance recorded: {meeting_title}"
MEETING_NOTES_SAVED_SUBJECT = "Board meeting notes saved: {meeting_title}"
MEETING_MINUTES_READY_SUBJECT = "Board meeting minutes ready: {meeting_title}"


def build_welcome_email_body(*, full_name: str) -> str:
    return (
        f"Hi {full_name},\n\n"
        "Your NSA Connect membership has been approved. "
        "You can now sign in with your @semo.edu account.\n\n"
        "Best,\n"
        "Nepalese Students' Association"
    )


def send_welcome_email(*, email: str, full_name: str) -> None:
    subject = WELCOME_EMAIL_SUBJECT
    body = build_welcome_email_body(full_name=full_name)

    if not settings.EMAIL_ENABLED:
        logger.info("Welcome email (disabled) to=%s subject=%s", email, subject)
        return

    if not settings.SENDGRID_API_KEY:
        logger.error(
            "Welcome email skipped: EMAIL_ENABLED=true but SENDGRID_API_KEY is missing"
        )
        return

    try:
        send_email(
            api_key=settings.SENDGRID_API_KEY,
            from_email=settings.EMAIL_FROM,
            to_email=email,
            subject=subject,
            body=body,
        )
        logger.info("Welcome email sent via SendGrid to=%s", email)
    except SendGridDeliveryError:
        logger.exception("SendGrid failed to deliver welcome email to=%s", email)
    except Exception:
        logger.exception("Unexpected error sending welcome email to=%s", email)


def build_prep_task_due_soon_email_body(
    *,
    full_name: str,
    event_title: str,
    group_name: str,
    due_date: datetime,
) -> str:
    due_label = due_date.astimezone(UTC).strftime("%B %d, %Y at %I:%M %p %Z")
    return (
        f"Hi {full_name},\n\n"
        f'Your prep task "{group_name}" for "{event_title}" is due on {due_label}.\n'
        "Please sign in to NSA Connect and complete the checklist before the deadline.\n\n"
        "Best,\n"
        "Nepalese Students' Association"
    )


def send_prep_task_due_soon_email(
    *,
    email: str,
    full_name: str,
    event_title: str,
    group_name: str,
    due_date: datetime,
) -> bool:
    subject = PREP_TASK_DUE_SOON_SUBJECT.format(group_name=group_name)
    body = build_prep_task_due_soon_email_body(
        full_name=full_name,
        event_title=event_title,
        group_name=group_name,
        due_date=due_date,
    )

    if not settings.EMAIL_ENABLED:
        logger.info(
            "Prep task due-soon email (disabled) to=%s subject=%s event=%s",
            email,
            subject,
            event_title,
        )
        return True

    if not settings.SENDGRID_API_KEY:
        logger.error(
            "Prep task due-soon email skipped: EMAIL_ENABLED=true but SENDGRID_API_KEY is missing"
        )
        return False

    try:
        send_email(
            api_key=settings.SENDGRID_API_KEY,
            from_email=settings.EMAIL_FROM,
            to_email=email,
            subject=subject,
            body=body,
        )
        logger.info("Prep task due-soon email sent via SendGrid to=%s", email)
        return True
    except SendGridDeliveryError:
        logger.exception("SendGrid failed to deliver prep task due-soon email to=%s", email)
        return False
    except Exception:
        logger.exception("Unexpected error sending prep task due-soon email to=%s", email)
        return False


def build_volunteer_task_assigned_email_body(
    *,
    full_name: str,
    task_name: str,
    event_title: str,
    event_starts_at: datetime,
) -> str:
    event_label = event_starts_at.astimezone(UTC).strftime("%B %d, %Y at %I:%M %p %Z")
    return (
        f"Hi {full_name},\n\n"
        f'You have been assigned to the volunteer task "{task_name}" '
        f'for "{event_title}" on {event_label}.\n'
        "Please sign in to NSA Connect to view event details.\n\n"
        "Best,\n"
        "Nepalese Students' Association"
    )


def send_volunteer_task_assigned_email(
    *,
    email: str,
    full_name: str,
    task_name: str,
    event_title: str,
    event_starts_at: datetime,
) -> bool:
    subject = VOLUNTEER_TASK_ASSIGNED_SUBJECT.format(task_name=task_name)
    body = build_volunteer_task_assigned_email_body(
        full_name=full_name,
        task_name=task_name,
        event_title=event_title,
        event_starts_at=event_starts_at,
    )

    if not settings.EMAIL_ENABLED:
        logger.info(
            "Volunteer task assigned email (disabled) to=%s subject=%s event=%s",
            email,
            subject,
            event_title,
        )
        return True

    if not settings.SENDGRID_API_KEY:
        logger.error(
            "Volunteer task assigned email skipped: EMAIL_ENABLED=true but SENDGRID_API_KEY is missing"
        )
        return False

    try:
        send_email(
            api_key=settings.SENDGRID_API_KEY,
            from_email=settings.EMAIL_FROM,
            to_email=email,
            subject=subject,
            body=body,
        )
        logger.info("Volunteer task assigned email sent via SendGrid to=%s", email)
        return True
    except SendGridDeliveryError:
        logger.exception(
            "SendGrid failed to deliver volunteer task assigned email to=%s",
            email,
        )
        return False
    except Exception:
        logger.exception(
            "Unexpected error sending volunteer task assigned email to=%s",
            email,
        )
        return False


def _meeting_notification_subject(
    *,
    notification_kind: str,
    meeting_title: str,
) -> str:
    if notification_kind == "attendance":
        return MEETING_ATTENDANCE_RECORDED_SUBJECT.format(meeting_title=meeting_title)
    if notification_kind == "summary":
        return MEETING_MINUTES_READY_SUBJECT.format(meeting_title=meeting_title)
    return MEETING_NOTES_SAVED_SUBJECT.format(meeting_title=meeting_title)


def build_meeting_record_notification_email_body(
    *,
    full_name: str,
    meeting_title: str,
    notification_kind: str,
    recorded_by_name: str,
    meeting_starts_at: datetime,
    meeting_url: str,
) -> str:
    meeting_label = meeting_starts_at.astimezone(UTC).strftime("%B %d, %Y at %I:%M %p %Z")

    if notification_kind == "attendance":
        lead = (
            f'{recorded_by_name} recorded board attendance for "{meeting_title}" '
            f"({meeting_label})."
        )
    elif notification_kind == "summary":
        lead = (
            f'{recorded_by_name} finalized AI-summarized minutes for "{meeting_title}" '
            f"({meeting_label})."
        )
    else:
        lead = (
            f'{recorded_by_name} saved meeting notes for "{meeting_title}" '
            f"({meeting_label})."
        )

    return (
        f"Hi {full_name},\n\n"
        f"{lead}\n"
        f"View the agenda, attendance roll call, and minutes in NSA Connect:\n"
        f"{meeting_url}\n\n"
        "Best,\n"
        "Nepalese Students' Association"
    )


def send_meeting_record_notification_email(
    *,
    email: str,
    full_name: str,
    meeting_title: str,
    notification_kind: str,
    recorded_by_name: str,
    meeting_starts_at: datetime,
    meeting_url: str,
) -> bool:
    subject = _meeting_notification_subject(
        notification_kind=notification_kind,
        meeting_title=meeting_title,
    )
    body = build_meeting_record_notification_email_body(
        full_name=full_name,
        meeting_title=meeting_title,
        notification_kind=notification_kind,
        recorded_by_name=recorded_by_name,
        meeting_starts_at=meeting_starts_at,
        meeting_url=meeting_url,
    )

    if not settings.EMAIL_ENABLED:
        logger.info(
            "Meeting record notification (disabled) to=%s subject=%s kind=%s",
            email,
            subject,
            notification_kind,
        )
        return True

    if not settings.SENDGRID_API_KEY:
        logger.error(
            "Meeting record notification skipped: EMAIL_ENABLED=true but SENDGRID_API_KEY is missing"
        )
        return False

    try:
        send_email(
            api_key=settings.SENDGRID_API_KEY,
            from_email=settings.EMAIL_FROM,
            to_email=email,
            subject=subject,
            body=body,
        )
        logger.info(
            "Meeting record notification sent via SendGrid to=%s kind=%s",
            email,
            notification_kind,
        )
        return True
    except SendGridDeliveryError:
        logger.exception(
            "SendGrid failed to deliver meeting record notification to=%s",
            email,
        )
        return False
    except Exception:
        logger.exception(
            "Unexpected error sending meeting record notification to=%s",
            email,
        )
        return False
