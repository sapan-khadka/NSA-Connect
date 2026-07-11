"""Authenticate members from a raw access-token string (WebSocket-safe)."""

from sqlalchemy.orm import Session

from app.core.security import InvalidTokenError, decode_access_token
from app.models.member import Member


class TokenAuthenticationError(Exception):
    """Raised when a token is missing, invalid, expired, or revoked."""


class TokenAuthorizationError(Exception):
    """Raised when the token is valid but the member cannot authenticate."""


def authenticate_member_from_token(db: Session, token: str | None) -> Member:
    """Mirror ``get_current_member`` checks without relying on HTTPBearer."""
    if not token or not token.strip():
        raise TokenAuthenticationError("Missing access token")

    try:
        payload = decode_access_token(token.strip())
    except InvalidTokenError as exc:
        raise TokenAuthenticationError("Invalid or expired token") from exc

    member_id = payload.get("member_id")
    if member_id is None:
        raise TokenAuthenticationError("Invalid token payload")

    member = db.get(Member, member_id)
    if member is None:
        raise TokenAuthenticationError("Member not found")

    if payload.get("email") != member.email:
        raise TokenAuthenticationError("Invalid token payload")

    if payload.get("tv") != member.token_version:
        raise TokenAuthenticationError("Token has been revoked")

    if not member.can_authenticate():
        raise TokenAuthorizationError("Member account is not approved")

    return member
