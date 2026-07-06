from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    JWT_ALGORITHM,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)


def test_create_access_token_contains_required_claims():
    token, expires_at = create_access_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
        token_version=1,
    )

    payload = decode_access_token(token)

    assert payload["member_id"] == 1
    assert payload["email"] == "sapan@semo.edu"
    assert payload["role"] == "general"
    assert payload["tv"] == 1
    assert payload["typ"] == TokenType.ACCESS.value
    assert payload["exp"] == int(expires_at.timestamp())


def test_create_refresh_token_contains_required_claims():
    token, expires_at = create_refresh_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
        token_version=2,
    )

    payload = decode_refresh_token(token)

    assert payload["member_id"] == 1
    assert payload["tv"] == 2
    assert payload["typ"] == TokenType.REFRESH.value
    assert payload["exp"] == int(expires_at.timestamp())


def test_decode_access_token_rejects_refresh_token_type():
    refresh_token, _ = create_refresh_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
        token_version=1,
    )

    try:
        decode_access_token(refresh_token)
        assert False, "Expected InvalidTokenError"
    except InvalidTokenError:
        pass


def test_decode_access_token_rejects_invalid_token():
    try:
        decode_access_token("not-a-valid-token")
        assert False, "Expected InvalidTokenError"
    except InvalidTokenError:
        pass


def test_decode_access_token_rejects_none_algorithm():
    payload = {
        "member_id": 1,
        "email": "sapan@semo.edu",
        "role": "general",
        "tv": 1,
        "typ": TokenType.ACCESS.value,
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    unsigned_token = jwt.encode(payload, "", algorithm="none")

    try:
        decode_access_token(unsigned_token)
        assert False, "Expected InvalidTokenError"
    except InvalidTokenError:
        pass
