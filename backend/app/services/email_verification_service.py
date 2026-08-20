from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_frontend_url, settings
from app.core.security import hash_password, verify_password
from app.models.email_verification_token import EmailVerificationToken
from app.models.member import Member
from app.services.email_verification_email_service import send_email_verification_email

EMAIL_VERIFICATION_REQUEST_MESSAGE = (
    "If an account needs verification for this email, a link has been sent."
)
EMAIL_VERIFICATION_INVALID_TOKEN_MESSAGE = (
    "This verification link is invalid or has expired. Request a new one."
)
EMAIL_VERIFICATION_SUCCESS_MESSAGE = "Email verified successfully."

logger = logging.getLogger(__name__)


class InvalidEmailVerificationTokenError(Exception):
    pass


def _expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )


def _invalidate_outstanding_tokens(db: Session, member_id: int) -> None:
    now = datetime.now(UTC)
    tokens = db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.member_id == member_id,
            EmailVerificationToken.used_at.is_(None),
        )
    ).all()
    for token in tokens:
        token.used_at = now


def issue_email_verification_token(db: Session, member: Member) -> str:
    raw_token = secrets.token_urlsafe(32)
    _invalidate_outstanding_tokens(db, member.id)
    db.add(
        EmailVerificationToken(
            member_id=member.id,
            token_hash=hash_password(raw_token),
            expires_at=_expires_at(),
        )
    )
    db.commit()
    return raw_token


def send_verification_email_for_member(db: Session, member: Member) -> bool:
    """Issue a token and send (or log) the verification link. Returns send success."""
    if member.email_verified_at is not None:
        return True

    raw_token = issue_email_verification_token(db, member)
    verify_url = f"{get_frontend_url()}/verify-email?token={raw_token}"

    if not settings.RESEND_API_KEY.strip():
        if settings.ENVIRONMENT == "production":
            logger.error(
                "Email verification skipped for member_id=%s: RESEND_API_KEY unset",
                member.id,
            )
        else:
            logger.warning(
                "Email verification link for %s (RESEND_API_KEY unset): %s",
                member.email,
                verify_url,
            )
        return False

    try:
        send_email_verification_email(
            to_email=member.email,
            full_name=member.full_name,
            verify_url=verify_url,
            expires_minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES,
        )
    except Exception:
        logger.exception("Failed to send verification email to %s", member.email)
        if settings.ENVIRONMENT != "production":
            logger.warning("Verification link for %s: %s", member.email, verify_url)
        return False
    return True


def verify_email_with_token(db: Session, raw_token: str) -> Member:
    now = datetime.now(UTC)
    candidates = db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > now,
        )
    ).all()

    matched: EmailVerificationToken | None = None
    for token in candidates:
        if verify_password(raw_token, token.token_hash):
            matched = token
            break

    if matched is None:
        raise InvalidEmailVerificationTokenError

    member = db.get(Member, matched.member_id)
    if member is None:
        raise InvalidEmailVerificationTokenError

    matched.used_at = now
    if member.email_verified_at is None:
        member.email_verified_at = now
        db.commit()
        db.refresh(member)

        from app.services.inbox_notification_service import notify_board_of_pending_member

        # Notify board only after the inbox is proven (skip org owners).
        if member.is_pending and not _member_is_org_owner(db, member):
            notify_board_of_pending_member(db, pending_member=member)
    else:
        db.commit()

    return member


def _member_is_org_owner(db: Session, member: Member) -> bool:
    from app.services.organization_context import (
        get_default_organization_id,
        get_membership_for_user,
    )

    membership = get_membership_for_user(
        db, member.id, get_default_organization_id(db)
    )
    return bool(membership and membership.is_org_owner)


def request_email_verification(db: Session, email: str) -> None:
    normalized = email.lower().strip()
    member = db.scalar(select(Member).where(Member.email == normalized))
    if member is None or member.email_verified_at is not None:
        return
    send_verification_email_for_member(db, member)
