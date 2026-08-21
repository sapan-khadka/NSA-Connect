"""Authenticate members from a raw access-token string (WebSocket-safe)."""

from sqlalchemy.orm import Session

from app.core.security import (
    InvalidTokenError,
    decode_ws_or_access_token,
)
from app.models.member import Member
from app.services.auth_service import (
    InvalidTokenPayloadError,
    MemberNotApprovedError,
    MemberNotFoundForTokenError,
    TokenRevokedError,
    load_authenticated_member,
)


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
