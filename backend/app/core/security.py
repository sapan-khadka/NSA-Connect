from datetime import UTC, datetime, timedelta
from enum import StrEnum

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_ALGORITHM = "HS256"


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidTokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _encode_token(payload: dict) -> str:
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_token(token: str, *, expected_type: TokenType) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "email", "role", "tv", "typ"]},
        )
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError from exc

    if payload.get("typ") != expected_type.value:
        raise InvalidTokenError

    if resolve_user_id(payload) is None:
        raise InvalidTokenError

    return payload


def resolve_user_id(payload: dict) -> int | None:
    """Read the authenticated user id from a decoded token payload.

    Tokens always set `user_id` and `member_id` to the same int (Phase 1
    compat while `Member`/`User` are the same ORM class); prefer `user_id`
    but fall back to `member_id` for tokens minted before this field existed.
    """
    user_id = payload.get("user_id")
    if user_id is not None:
        return user_id
    return payload.get("member_id")


def create_access_token(
    *,
    member_id: int,
    email: str,
    role: str,
    token_version: int,
) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "member_id": member_id,
        "user_id": member_id,
        "email": email,
        "role": role,
        "tv": token_version,
        "typ": TokenType.ACCESS.value,
        "exp": expires_at,
    }
    return _encode_token(payload), expires_at


def create_refresh_token(
    *,
    member_id: int,
    email: str,
    role: str,
    token_version: int,
) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "member_id": member_id,
        "user_id": member_id,
        "email": email,
        "role": role,
        "tv": token_version,
        "typ": TokenType.REFRESH.value,
        "exp": expires_at,
    }
    return _encode_token(payload), expires_at


def create_token_pair(
    *,
    member_id: int,
    email: str,
    role: str,
    token_version: int,
) -> tuple[str, datetime, str, datetime]:
    access_token, access_expires_at = create_access_token(
        member_id=member_id,
        email=email,
        role=role,
        token_version=token_version,
    )
    refresh_token, refresh_expires_at = create_refresh_token(
        member_id=member_id,
        email=email,
        role=role,
        token_version=token_version,
    )
    return access_token, access_expires_at, refresh_token, refresh_expires_at


def decode_access_token(token: str) -> dict:
    return _decode_token(token, expected_type=TokenType.ACCESS)


def decode_refresh_token(token: str) -> dict:
    return _decode_token(token, expected_type=TokenType.REFRESH)
