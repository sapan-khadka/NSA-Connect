import logging

from app.core.config import settings
from app.integrations.sendgrid_client import SendGridDeliveryError, send_email

logger = logging.getLogger(__name__)

WELCOME_EMAIL_SUBJECT = "Welcome to NSA Connect"


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
