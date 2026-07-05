import logging
from typing import Literal

from app.core.config import settings
from app.integrations.resend_client import ResendDeliveryError, send_email

logger = logging.getLogger(__name__)

TEST_EMAIL_SUBJECT = "NSA Connect test email"


def _resolve_recipient(to_email: str) -> str:
    """Redirect to EMAIL_TEST_OVERRIDE_RECIPIENT when configured (dev/testing only)."""
    override = settings.EMAIL_TEST_OVERRIDE_RECIPIENT.strip()
    if not override:
        return to_email
    if to_email.strip().lower() == override.lower():
        return to_email

    logger.warning(
        "Email intended for %s redirected to test override %s",
        to_email,
        override,
    )
    return override


def send_resend_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    body_format: Literal["html", "text"] = "text",
) -> str:
    """Reusable Resend send helper. Returns the Resend email id."""
    if not settings.RESEND_API_KEY:
        raise ResendDeliveryError("RESEND_API_KEY is not configured")

    delivery_email = _resolve_recipient(to_email)

    try:
        email_id = send_email(
            api_key=settings.RESEND_API_KEY,
            from_email=settings.RESEND_FROM_EMAIL,
            to_email=delivery_email,
            subject=subject,
            body=body,
            body_format=body_format,
        )
    except ResendDeliveryError:
        logger.exception(
            "Resend failed to deliver email intended_for=%s delivered_to=%s subject=%s",
            to_email,
            delivery_email,
            subject,
        )
        raise

    logger.info(
        "Resend email sent intended_for=%s delivered_to=%s subject=%s id=%s",
        to_email,
        delivery_email,
        subject,
        email_id,
    )
    return email_id


def send_test_email(*, to_email: str, recipient_name: str | None = None) -> str:
    greeting_name = recipient_name or to_email
    body = (
        f"Hi {greeting_name},\n\n"
        "This is a test email from NSA Connect confirming that Resend is connected.\n\n"
        "If you received this message, the email notification foundation is working."
    )
    return send_resend_email(
        to_email=to_email,
        subject=TEST_EMAIL_SUBJECT,
        body=body,
        body_format="text",
    )
