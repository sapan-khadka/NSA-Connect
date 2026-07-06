"""Shared password strength rules for registration and password changes."""

from __future__ import annotations

import re

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

# Top common passwords — keep in sync with frontend/src/lib/common-passwords.ts
COMMON_PASSWORDS: frozenset[str] = frozenset(
    {
        "password",
        "password1",
        "password12",
        "password123",
        "123456",
        "1234567",
        "12345678",
        "123456789",
        "1234567890",
        "qwerty",
        "qwerty123",
        "qwertyuiop",
        "abc123",
        "abc12345",
        "111111",
        "000000",
        "123123",
        "654321",
        "666666",
        "7777777",
        "888888",
        "999999",
        "iloveyou",
        "princess",
        "admin",
        "admin123",
        "welcome",
        "welcome1",
        "welcome123",
        "letmein",
        "login",
        "master",
        "hello",
        "hello123",
        "football",
        "baseball",
        "soccer",
        "monkey",
        "dragon",
        "shadow",
        "sunshine",
        "ashley",
        "bailey",
        "passw0rd",
        "trustno1",
        "superman",
        "batman",
        "starwars",
        "access",
        "flower",
        "hockey",
        "killer",
        "pepper",
        "jordan",
        "hunter",
        "ranger",
        "buster",
        "thomas",
        "robert",
        "daniel",
        "joshua",
        "michael",
        "charlie",
        "andrew",
        "matthew",
        "jennifer",
        "jessica",
        "nicole",
        "amanda",
        "samantha",
        "summer",
        "winter",
        "spring",
        "autumn",
        "mustang",
        "corvette",
        "ferrari",
        "porsche",
        "mercedes",
        "computer",
        "internet",
        "google",
        "apple",
        "samsung",
        "microsoft",
        "changeme",
        "default",
        "secret",
        "secret123",
        "test",
        "test123",
        "testing",
        "testing123",
        "guest",
        "guest123",
        "root",
        "toor",
        "pass",
        "pass123",
        "pass1234",
        "qazwsx",
        "zaq12wsx",
        "1q2w3e4r",
        "1qaz2wsx",
        "asdfgh",
        "asdfghjkl",
        "zxcvbn",
        "zxcvbnm",
        "qweasd",
        "qweasdzxc",
        "password!",
        "p@ssw0rd",
        "p@ssword",
        "Password1",
        "Password123",
        "Qwerty123",
        "iloveyou1",
        "whatever",
        "nothing",
        "unknown",
        "freedom",
        "forever",
        "cookie",
        "cheese",
        "chocolate",
        "coffee",
        "purple",
        "yellow",
        "orange",
        "silver",
        "golden",
        "diamond",
        "thunder",
        "lightning",
        "rainbow",
        "unicorn",
        "pokemon",
        "minecraft",
        "fortnite",
        "semo",
        "semo123",
        "semo1234",
        "college",
        "college1",
        "student",
        "student1",
        "university",
    }
)


class WeakPasswordError(ValueError):
    pass


def _email_local_part(email: str) -> str:
    return email.split("@", 1)[0].lower().strip()


def _name_tokens(full_name: str) -> list[str]:
    return [
        token.lower()
        for token in re.findall(r"[A-Za-z]+", full_name)
        if len(token) >= 3
    ]


def validate_password_strength(
    password: str,
    *,
    email: str,
    full_name: str,
) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise WeakPasswordError("Password must be at least 8 characters")

    if len(password) > PASSWORD_MAX_LENGTH:
        raise WeakPasswordError("Password must be at most 128 characters")

    lowered = password.lower()

    if lowered in COMMON_PASSWORDS:
        raise WeakPasswordError(
            "This password is too common — choose something more unique"
        )

    local_part = _email_local_part(email)
    if len(local_part) >= 3 and local_part in lowered:
        raise WeakPasswordError("Password cannot contain your email address")

    for token in _name_tokens(full_name):
        if token in lowered:
            raise WeakPasswordError("Password cannot contain your name")
