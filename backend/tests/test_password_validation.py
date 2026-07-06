import pytest

from app.core.password_validation import (
    WeakPasswordError,
    validate_password_strength,
)


def test_validate_password_strength_accepts_strong_password():
    validate_password_strength(
        "river-canyon-orchid",
        email="sapan@semo.edu",
        full_name="Sapan Khadka",
    )


def test_validate_password_strength_rejects_short_password():
    with pytest.raises(WeakPasswordError, match="at least 8 characters"):
        validate_password_strength(
            "short",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_common_password():
    with pytest.raises(WeakPasswordError, match="too common"):
        validate_password_strength(
            "password123",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_email_local_part():
    with pytest.raises(WeakPasswordError, match="email address"):
        validate_password_strength(
            "sapanrocks!",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_name_token():
    with pytest.raises(WeakPasswordError, match="your name"):
        validate_password_strength(
            "khadka-river-9",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )
