from app.services.resend_email_service import send_resend_email

EMAIL_VERIFICATION_SUBJECT = "Verify your NSA Connect email"


def send_email_verification_email(
    *,
    to_email: str,
    full_name: str,
    verify_url: str,
    expires_minutes: int,
) -> str:
    body = (
        f"Hi {full_name},\n\n"
        "Confirm this email address to finish creating your NSA Connect account.\n\n"
        f"Verify email: {verify_url}\n\n"
        f"This link expires in {expires_minutes} minutes.\n\n"
        "If you did not register for NSA Connect, you can ignore this message.\n\n"
        "NSA Connect"
    )
    return send_resend_email(
        to_email=to_email,
        subject=EMAIL_VERIFICATION_SUBJECT,
        body=body,
    )
