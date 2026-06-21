import pytest

from app.core.validators import SEMO_EMAIL_DOMAIN, validate_semo_email


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
