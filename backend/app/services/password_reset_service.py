from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.password_validation import validate_password_strength
from app.core.security import hash_password, verify_password
from app.models.member import Member, MemberStatus
from app.models.password_reset_token import PasswordResetToken
from app.services.password_reset_email_service import send_password_reset_email

PASSWORD_RESET_REQUEST_MESSAGE = (
    "If an account exists for this email, a reset link has been sent."
)
PASSWORD_RESET_RATE_LIMIT_MESSAGE = (
    "Too many password reset requests — please try again later."
)
PASSWORD_RESET_INVALID_TOKEN_MESSAGE = (
    "This reset link is invalid or has expired. Please request a new password reset."
)

logger = logging.getLogger(__name__)


class InvalidPasswordResetTokenError(Exception):
    pass


def _normalize_email(email: str) -> str:
    return email.lower().strip()


def _expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)


def _invalidate_outstanding_tokens(db: Session, member_id: int) -> None:
    now = datetime.now(UTC)
    tokens = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.member_id == member_id,
            PasswordResetToken.used_at.is_(None),
        )
    ).all()
    for token in tokens:
        token.used_at = now


def request_password_reset(db: Session, email: str) -> None:
    normalized_email = _normalize_email(email)
    member = db.scalar(select(Member).where(Member.email == normalized_email))

    if member is None or member.status != MemberStatus.APPROVED:
        return

    raw_token = secrets.token_urlsafe(32)
    _invalidate_outstanding_tokens(db, member.id)

    reset_token = PasswordResetToken(
        member_id=member.id,
        token_hash=hash_password(raw_token),
        expires_at=_expires_at(),
    )
    db.add(reset_token)
    db.commit()

    reset_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
    )
    try:
        send_password_reset_email(
            to_email=member.email,
            full_name=member.full_name,
            reset_url=reset_url,
            expires_minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES,
        )
    except Exception:
        logger.exception(
            "Failed to send password reset email to %s",
            member.email,
        )


def _find_valid_token(db: Session, raw_token: str) -> PasswordResetToken | None:
    now = datetime.now(UTC)
    candidates = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    ).all()

    for candidate in candidates:
        if verify_password(raw_token, candidate.token_hash):
            return candidate
    return None


def reset_password_with_token(db: Session, *, raw_token: str, new_password: str) -> None:
    reset_token = _find_valid_token(db, raw_token)
    if reset_token is None:
        raise InvalidPasswordResetTokenError

    member = db.get(Member, reset_token.member_id)
    if member is None or member.status != MemberStatus.APPROVED:
        raise InvalidPasswordResetTokenError

    validate_password_strength(
        new_password,
        email=member.email,
        full_name=member.full_name,
    )

    member.hashed_password = hash_password(new_password)
    member.token_version = (member.token_version or 1) + 1
    reset_token.used_at = datetime.now(UTC)
    db.commit()
