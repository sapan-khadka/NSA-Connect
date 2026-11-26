"""Authenticate members from a raw access-token string (WebSocket-safe)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    decode_ws_or_access_token,
    decode_ws_ticket,
)
from app.models.member import Member
from app.services.auth_service import (
    InvalidTokenPayloadError,
    MemberNotApprovedError,
    MemberNotFoundForTokenError,
    TokenRevokedError,
    load_authenticated_member,
)
from app.services.ws_ticket_replay import consume_ws_ticket


class TokenAuthenticationError(Exception):
    """Raised when a token is missing, invalid, expired, or revoked."""


class TokenAuthorizationError(Exception):
    """Raised when the token is valid but the member cannot authenticate."""


def authenticate_member_from_token(db: Session, token: str | None) -> Member:
    """Mirror ``get_current_member`` checks without relying on HTTPBearer.

    Accepts short-lived WS tickets (preferred) or access tokens.
    """
    if not token or not token.strip():
        raise TokenAuthenticationError("Missing access token")

    try:
        payload = decode_ws_or_access_token(token.strip())
    except InvalidTokenError as exc:
        raise TokenAuthenticationError("Invalid or expired token") from exc

    try:
        return load_authenticated_member(db, payload)
    except InvalidTokenPayloadError as exc:
        raise TokenAuthenticationError("Invalid token payload") from exc
    except MemberNotFoundForTokenError as exc:
        raise TokenAuthenticationError("Member not found") from exc
    except TokenRevokedError as exc:
        raise TokenAuthenticationError("Token has been revoked") from exc
    except MemberNotApprovedError as exc:
        raise TokenAuthorizationError("Member account is not approved") from exc


def authenticate_ws_ticket(db: Session, token: str | None) -> Member:
    """Accept one short-lived WebSocket ticket and reject every other credential."""
    if not token or not token.strip() or len(token) > 4096:
        raise TokenAuthenticationError("Missing access token")

    try:
        payload = decode_ws_ticket(token.strip())
    except InvalidTokenError as exc:
        raise TokenAuthenticationError("Invalid or expired token") from exc

    jti = payload.get("jti")
    issued_at = payload.get("iat")
    expires_at = payload.get("exp")
    if (
        not isinstance(jti, str)
        or not jti
        or len(jti) > 80
        or isinstance(issued_at, bool)
        or not isinstance(issued_at, int | float)
        or isinstance(expires_at, bool)
        or not isinstance(expires_at, int | float)
    ):
        raise TokenAuthenticationError("Invalid or expired token")

    issued = datetime.fromtimestamp(issued_at, UTC)
    expires = datetime.fromtimestamp(expires_at, UTC)
    now = datetime.now(UTC)
    max_lifetime = timedelta(seconds=settings.WS_TICKET_EXPIRE_SECONDS + 5)
    if (
        expires <= issued
        or expires - issued > max_lifetime
        or issued > now + timedelta(seconds=30)
    ):
        raise TokenAuthenticationError("Invalid or expired token")

    remaining = int((expires - now).total_seconds())
    if remaining <= 0 or not consume_ws_ticket(jti, remaining):
        raise TokenAuthenticationError("Invalid or expired token")

    try:
        return load_authenticated_member(db, payload)
    except InvalidTokenPayloadError as exc:
        raise TokenAuthenticationError("Invalid token payload") from exc
    except MemberNotFoundForTokenError as exc:
        raise TokenAuthenticationError("Member not found") from exc
    except TokenRevokedError as exc:
        raise TokenAuthenticationError("Token has been revoked") from exc
    except MemberNotApprovedError as exc:
        raise TokenAuthorizationError("Member account is not approved") from exc
