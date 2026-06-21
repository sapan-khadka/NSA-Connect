from typing import Annotated

from pydantic import AfterValidator, EmailStr

SEMO_EMAIL_DOMAIN = "semo.edu"


def validate_semo_email(value: str) -> str:
    email = value.lower().strip()
    domain = email.rsplit("@", 1)[-1]

    if domain != SEMO_EMAIL_DOMAIN:
        raise ValueError(f"Email must be a @{SEMO_EMAIL_DOMAIN} address")

    return email


SemoEmailStr = Annotated[EmailStr, AfterValidator(validate_semo_email)]
