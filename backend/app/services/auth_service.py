"""Shared member authentication from decoded JWT payloads."""

from enum import StrEnum

from sqlalchemy.orm import Session

from app.core.security import resolve_user_id
from app.models.member import Member
from app.services.organization_context import ensure_membership_for_member


class AuthTokenKind(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"
    WS = "ws"


class MemberAuthError(Exception):
    """Base class for token→member validation failures."""


class InvalidTokenPayloadError(MemberAuthError):
    pass


class MemberNotFoundForTokenError(MemberAuthError):
    pass


class TokenRevokedError(MemberAuthError):
    pass


class MemberNotApprovedError(MemberAuthError):
    pass


def invalid_payload_detail(kind: AuthTokenKind) -> str:
    if kind is AuthTokenKind.REFRESH:
        return "Invalid refresh token payload"
    return "Invalid token payload"


def revoked_detail(kind: AuthTokenKind) -> str:
    if kind is AuthTokenKind.REFRESH:
        return "Refresh token has been revoked"
    return "Token has been revoked"


def load_authenticated_member(
    db: Session,
    payload: dict,
    *,
    attach_membership: bool = True,
) -> Member:
    """Validate a decoded token payload and return the matching member.

    Raises ``MemberAuthError`` subclasses when the token is stale or the
    member cannot authenticate. Callers map those to HTTP/WS responses.
    """
    user_id = resolve_user_id(payload)
    if user_id is None:
        raise InvalidTokenPayloadError()

    member = db.get(Member, user_id)
    if member is None:
        raise MemberNotFoundForTokenError()

    if payload.get("email") != member.email:
        raise InvalidTokenPayloadError()

    if payload.get("tv") != member.token_version:
        raise TokenRevokedError()

    if not member.can_authenticate():
        raise MemberNotApprovedError()

    if attach_membership:
        membership = ensure_membership_for_member(db, member)
        member._active_organization_id = membership.organization_id
        member._active_membership = membership

    return member
