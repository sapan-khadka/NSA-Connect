from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


class SendGridDeliveryError(Exception):
    pass


def send_email(
    *,
    api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
) -> None:
    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject=subject,
        plain_text_content=body,
    )
    client = SendGridAPIClient(api_key)
    response = client.send(message)

    if response.status_code >= 400:
        raise SendGridDeliveryError(
            f"SendGrid returned {response.status_code}: {response.body}"
        )
