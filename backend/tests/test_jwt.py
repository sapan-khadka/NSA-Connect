import jwt

from app.core.security import create_access_token, decode_access_token


def test_create_access_token_contains_required_claims():
    token, expires_at = create_access_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
    )

    payload = decode_access_token(token)

    assert payload["member_id"] == 1
    assert payload["email"] == "sapan@semo.edu"
    assert payload["role"] == "general"
    assert payload["exp"] == int(expires_at.timestamp())


def test_decode_access_token_rejects_invalid_token():
    try:
        decode_access_token("not-a-valid-token")
        assert False, "Expected jwt.DecodeError"
    except jwt.InvalidTokenError:
        pass
