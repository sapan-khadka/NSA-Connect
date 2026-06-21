from app.core.security import hash_password, verify_password


def test_hash_password_returns_bcrypt_hash():
    hashed = hash_password("securepass123")

    assert hashed != "securepass123"
    assert hashed.startswith("$2b$")


def test_verify_password_accepts_correct_password():
    password = "securepass123"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("securepass123")

    assert verify_password("wrongpassword", hashed) is False


def test_hash_password_produces_unique_hashes():
    password = "securepass123"
    first = hash_password(password)
    second = hash_password(password)

    assert first != second
    assert verify_password(password, first) is True
    assert verify_password(password, second) is True
