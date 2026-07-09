from typing import Literal

import resend


class ResendDeliveryError(Exception):
    pass


def send_email(
    *,
    api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    body_format: Literal["html", "text"] = "text",
) -> str:
    """Send an email via Resend. Returns the Resend email id."""
    resend.api_key = api_key

    params: resend.Emails.SendParams = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
    }

    if body_format == "html":
        params["html"] = body
    else:
        params["text"] = body

    try:
        response = resend.Emails.send(params)
    except Exception as exc:
        raise ResendDeliveryError(str(exc)) from exc

    email_id = (
        response.get("id")
        if isinstance(response, dict)
        else getattr(response, "id", None)
    )
    if not email_id:
        raise ResendDeliveryError(
            f"Resend returned an unexpected response: {response!r}"
        )

    return str(email_id)
