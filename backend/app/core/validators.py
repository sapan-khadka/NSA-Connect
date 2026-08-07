import re
from typing import Annotated

from pydantic import AfterValidator, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.university import University

SEMO_EMAIL_DOMAIN = "semo.edu"
STUDENT_ID_PATTERN = re.compile(r"^[A-Z0-9]{6,20}$")


def validate_student_id(value: str) -> str:
    student_id = value.strip().upper()

    if not STUDENT_ID_PATTERN.fullmatch(student_id):
        raise ValueError("Student ID must be 6-20 letters or numbers")

    return student_id


def validate_semo_email(value: str) -> str:
    """Legacy validator: @semo.edu only (kept for callers that do not have a DB session)."""
    email = value.lower().strip()
    domain = email.rsplit("@", 1)[-1]

    if domain != SEMO_EMAIL_DOMAIN:
        raise ValueError(f"Email must be a @{SEMO_EMAIL_DOMAIN} address")

    return email


def validate_university_email(db: Session, value: str) -> str:
    """Validate email against a known university email_domain (case-insensitive).

    Falls back to the default university domain when only one university exists
    or when no domain row matches yet (single-tenant SEMO runtime).
    """
    email = value.lower().strip()
    if "@" not in email:
        raise ValueError("Invalid email address")
    domain = email.rsplit("@", 1)[-1]

    match = db.scalar(
        select(University).where(
            func.lower(University.email_domain) == domain,
        ),
    )
    if match is not None:
        return email

    from app.services.organization_context import get_default_university

    default = get_default_university(db)
    expected = (default.email_domain or SEMO_EMAIL_DOMAIN).lower()
    if domain != expected:
        raise ValueError(f"Email must be a @{expected} address")
    return email


def university_for_email(db: Session, email: str) -> University | None:
    domain = email.lower().strip().rsplit("@", 1)[-1]
    match = db.scalar(
        select(University).where(
            func.lower(University.email_domain) == domain,
        ),
    )
    if match is not None:
        return match
    from app.services.organization_context import get_default_university

    default = get_default_university(db)
    expected = (default.email_domain or SEMO_EMAIL_DOMAIN).lower()
    if domain == expected:
        return default
    return None


SemoEmailStr = Annotated[EmailStr, AfterValidator(validate_semo_email)]
StudentIdStr = Annotated[
    str,
    Field(min_length=6, max_length=20),
    AfterValidator(validate_student_id),
]
