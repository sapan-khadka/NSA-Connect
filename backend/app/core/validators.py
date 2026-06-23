import re
from typing import Annotated

from pydantic import AfterValidator, EmailStr, Field

SEMO_EMAIL_DOMAIN = "semo.edu"
STUDENT_ID_PATTERN = re.compile(r"^[A-Z0-9]{6,20}$")


def validate_semo_email(value: str) -> str:
    email = value.lower().strip()
    domain = email.rsplit("@", 1)[-1]

    if domain != SEMO_EMAIL_DOMAIN:
        raise ValueError(f"Email must be a @{SEMO_EMAIL_DOMAIN} address")

    return email


def validate_student_id(value: str) -> str:
    student_id = value.strip().upper()

    if not STUDENT_ID_PATTERN.fullmatch(student_id):
        raise ValueError("Student ID must be 6-20 letters or numbers")

    return student_id


SemoEmailStr = Annotated[EmailStr, AfterValidator(validate_semo_email)]
StudentIdStr = Annotated[
    str,
    Field(min_length=6, max_length=20),
    AfterValidator(validate_student_id),
]
