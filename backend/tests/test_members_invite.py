from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from conftest import (
    VALID_GRADUATION_YEAR,
    VALID_MAJOR,
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import func, select

from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.password_reset_token import PasswordResetToken
from app.services.password_reset_email_service import (
    PASSWORD_SETUP_SUBJECT,
    send_password_setup_email,
)

INVITE_URL = "/api/v1/members/invite"
RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm"
LOGIN_URL = "/api/v1/auth/login"
NEW_PASSWORD = "river-canyon-9"


def _payload(
    *,
    email: str = "invited@semo.edu",
    student_id: str = "I1234567",
) -> dict:
    return {
        "full_name": "Invited Member",
        "email": email,
        "student_id": student_id,
        "major": VALID_MAJOR,
        "graduation_year": VALID_GRADUATION_YEAR,
        "phone": "573-555-0100",
    }


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def capture_setup_email():
    captured: dict[str, str] = {}

    def fake_send(
        *,
        to_email: str,
        full_name: str,
        setup_url: str,
        expires_minutes: int,
    ) -> str:
        captured.update(
            {
                "to_email": to_email,
                "full_name": full_name,
                "setup_url": setup_url,
                "expires_minutes": str(expires_minutes),
            },
        )
        return "setup-email-id"

    with patch(
        "app.services.password_reset_service.send_password_setup_email",
        side_effect=fake_send,
    ):
        yield captured


def test_general_member_cannot_invite(client, general_member_headers):
    response = client.post(
        INVITE_URL,
        headers=general_member_headers,
        json=_payload(),
    )
    assert response.status_code == 403


def test_board_invite_creates_approved_general_member(
    client,
    db_session,
    board_member_headers,
    capture_setup_email,
):
    response = client.post(
        INVITE_URL,
        headers=board_member_headers,
        json=_payload(),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["setup_email_sent"] is True
    assert body["member"]["status"] == MemberStatus.APPROVED
    assert body["member"]["role"] == MemberRole.GENERAL
    assert body["member"]["position"] == MemberPosition.MEMBER

    member = db_session.scalar(
        select(Member).where(Member.email == "invited@semo.edu"),
    )
    assert member is not None
    assert member.status == MemberStatus.APPROVED
    assert member.role == MemberRole.GENERAL
    assert member.position == MemberPosition.MEMBER
    assert capture_setup_email["to_email"] == member.email
    assert "mode=setup" in capture_setup_email["setup_url"]


def test_invite_duplicate_email_returns_409(
    client,
    db_session,
    board_member_headers,
):
    register_member(client, email="existing@semo.edu", student_id="33333333")

    response = client.post(
        INVITE_URL,
        headers=board_member_headers,
        json=_payload(email="existing@semo.edu"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_invite_duplicate_student_id_returns_409(
    client,
    board_member_headers,
):
    register_member(client, email="existing@semo.edu", student_id="33333333")

    response = client.post(
        INVITE_URL,
        headers=board_member_headers,
        json=_payload(student_id="33333333"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Student ID already registered"


def test_invited_member_placeholder_password_cannot_log_in(
    client,
    board_member_headers,
    capture_setup_email,
):
    invite = client.post(
        INVITE_URL,
        headers=board_member_headers,
        json=_payload(),
    )
    assert invite.status_code == 201

    login = client.post(
        LOGIN_URL,
        json={"email": "invited@semo.edu", "password": VALID_PASSWORD},
    )
    assert login.status_code == 401


def test_setup_email_provider_exception_returns_false_and_keeps_member(
    client,
    db_session,
    board_member_headers,
):
    with patch(
        "app.services.password_reset_service.send_password_setup_email",
        side_effect=RuntimeError("provider unavailable"),
    ):
        response = client.post(
            INVITE_URL,
            headers=board_member_headers,
            json=_payload(),
        )

    assert response.status_code == 201
    assert response.json()["setup_email_sent"] is False
    member = db_session.scalar(
        select(Member).where(Member.email == "invited@semo.edu"),
    )
    assert member is not None
    token_count = db_session.scalar(
        select(func.count())
        .select_from(PasswordResetToken)
        .where(PasswordResetToken.member_id == member.id),
    )
    assert token_count == 1


def test_setup_token_confirms_password_and_allows_login(
    client,
    board_member_headers,
    capture_setup_email,
):
    invite = client.post(
        INVITE_URL,
        headers=board_member_headers,
        json=_payload(),
    )
    assert invite.status_code == 201
    assert invite.json()["setup_email_sent"] is True

    setup_url = capture_setup_email["setup_url"]
    query = parse_qs(urlparse(setup_url).query)
    assert query["mode"] == ["setup"]
    token = query["token"][0]

    confirm = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert confirm.status_code == 200

    login = client.post(
        LOGIN_URL,
        json={"email": "invited@semo.edu", "password": NEW_PASSWORD},
    )
    assert login.status_code == 200


def test_password_setup_email_uses_reviewed_subject_and_body():
    with patch(
        "app.services.password_reset_email_service.send_resend_email",
        return_value="email-id",
    ) as send:
        result = send_password_setup_email(
            to_email="invited@semo.edu",
            full_name="Invited Member",
            setup_url="https://app.test/reset-password?token=abc&mode=setup",
            expires_minutes=30,
        )

    assert result == "email-id"
    kwargs = send.call_args.kwargs
    assert kwargs["subject"] == PASSWORD_SETUP_SUBJECT
    assert "Set up your password" in kwargs["body"]
    assert "mode=setup" in kwargs["body"]
