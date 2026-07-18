from app.services.resend_email_service import send_resend_email

PASSWORD_RESET_SUBJECT = "NSA Connect password reset"
PASSWORD_SETUP_SUBJECT = "Set up your NSA Connect password"


def send_password_reset_email(
    *,
    to_email: str,
    full_name: str,
    reset_url: str,
    expires_minutes: int,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        "We received a request to reset your NSA Connect password.\n\n"
        f"Reset your password: {reset_url}\n\n"
        f"This link expires in {expires_minutes} minutes.\n\n"
        "If you didn't request this, you can ignore this email.\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=PASSWORD_RESET_SUBJECT,
        body=body,
    )


def send_password_setup_email(
    *,
    to_email: str,
    full_name: str,
    setup_url: str,
    expires_minutes: int,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        "You’ve been added to NSA Connect.\n\n"
        f"Set up your password: {setup_url}\n\n"
        f"This link expires in {expires_minutes} minutes.\n\n"
        "If you weren’t expecting this invitation, you can ignore this email.\n\n"
        "— NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=PASSWORD_SETUP_SUBJECT,
        body=body,
    )
