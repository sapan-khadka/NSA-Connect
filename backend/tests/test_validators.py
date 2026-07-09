import pytest

from app.core.validators import (
    SEMO_EMAIL_DOMAIN,
    validate_semo_email,
    validate_student_id,
)


def test_validate_semo_email_accepts_valid_address():
    assert validate_semo_email("student@semo.edu") == "student@semo.edu"


def test_validate_semo_email_normalizes_case():
    assert validate_semo_email("Student@SEMO.EDU") == "student@semo.edu"


def test_validate_semo_email_rejects_other_domains():
    with pytest.raises(ValueError, match=SEMO_EMAIL_DOMAIN):
        validate_semo_email("student@gmail.com")


def test_validate_semo_email_rejects_lookalike_domain():
    with pytest.raises(ValueError, match=SEMO_EMAIL_DOMAIN):
        validate_semo_email("student@semo.edu.evil.com")


def test_validate_student_id_accepts_letter_prefix():
    assert validate_student_id("s12345678") == "S12345678"


def test_validate_student_id_rejects_special_characters():
    with pytest.raises(ValueError, match="letters or numbers"):
        validate_student_id("bad-id!")
