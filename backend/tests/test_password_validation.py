import pytest

from app.core.password_validation import (
    WeakPasswordError,
    validate_password_strength,
)


def test_validate_password_strength_accepts_strong_password():
    validate_password_strength(
        "correct horse battery",
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


def test_validate_password_strength_rejects_all_digit_password():
    with pytest.raises(WeakPasswordError, match="only numbers"):
        validate_password_strength(
            "111222333",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_repeated_character_pattern():
    with pytest.raises(WeakPasswordError, match="too repetitive"):
        validate_password_strength(
            "aaabbbcc",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_repeated_character_password():
    with pytest.raises(WeakPasswordError, match="too repetitive"):
        validate_password_strength(
            "aaaaaaaa",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_common_password():
    with pytest.raises(WeakPasswordError, match="too common"):
        validate_password_strength(
            "password",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_blocklisted_qwerty123():
    with pytest.raises(WeakPasswordError):
        validate_password_strength(
            "qwerty123",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_sequential_digits():
    with pytest.raises(WeakPasswordError):
        validate_password_strength(
            "12345678",
            email="sapan@semo.edu",
            full_name="Sapan Khadka",
        )


def test_validate_password_strength_rejects_sequential_letters():
    with pytest.raises(WeakPasswordError, match="simple keyboard or number sequences"):
        validate_password_strength(
            "abcdefgh",
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
