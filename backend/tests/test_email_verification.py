"""Email verification gates fake @semo.edu registrations."""

from conftest import (
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    login_member,
    mark_email_verified,
    register_member,
)
from sqlalchemy import select

from app.core.security import verify_password
from app.models.email_verification_token import EmailVerificationToken
from app.models.inbox_notification import InboxNotification
from app.models.member import Member, MemberStatus


def _raw_token_for_email(db_session, email: str) -> str:
    """Recover the issued raw token by minting a known one after registration."""
    from app.services.email_verification_service import issue_email_verification_token

    member = db_session.scalar(select(Member).where(Member.email == email))
    assert member is not None
    return issue_email_verification_token(db_session, member)


def test_login_rejects_unverified_email(client, db_session):
    create_board_member(db_session)
    register_member(client, email="unverified@semo.edu", student_id="11111111")

    response = login_member(client, email="unverified@semo.edu")

    assert response.status_code == 403
    assert response.json()["detail"] == "Verify your email before signing in"


def test_verify_email_then_pending_login_still_blocked(client, db_session):
    create_board_member(db_session)
    register_member(client, email="pending@semo.edu", student_id="22222222")
    token = _raw_token_for_email(db_session, "pending@semo.edu")

    verified = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verified.status_code == 200

    login = login_member(client, email="pending@semo.edu")
    assert login.status_code == 403
    assert login.json()["detail"] == "Member account is not approved"


def test_board_sees_only_verified_pending_members(client, db_session):
    create_board_member(db_session)
    register_member(client, email="ghost@semo.edu", student_id="33333333")
    register_member(client, email="real@semo.edu", student_id="44444444")
    mark_email_verified(db_session, email="real@semo.edu")

    response = client.get(
        "/api/v1/members/pending",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["members"][0]["email"] == "real@semo.edu"


def test_cannot_approve_unverified_pending_member(client, db_session):
    create_board_member(db_session)
    pending = register_member(
        client, email="needverify@semo.edu", student_id="55555555"
    )
    member_id = pending.json()["id"]

    approve = client.patch(
        f"/api/v1/members/{member_id}/approve",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert approve.status_code == 400
    assert "verify" in approve.json()["detail"].lower()


def test_verify_then_approve_allows_login(client, db_session):
    create_board_member(db_session)
    pending = register_member(
        client, email="student@semo.edu", student_id="66666666"
    )
    member_id = pending.json()["id"]
    token = _raw_token_for_email(db_session, "student@semo.edu")

    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200

    approve = client.patch(
        f"/api/v1/members/{member_id}/approve",
        headers=auth_header(client, email="board@semo.edu"),
    )
    assert approve.status_code == 200

    login = login_member(client, email="student@semo.edu", password=VALID_PASSWORD)
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_board_notified_only_after_email_verified(client, db_session):
    create_board_member(db_session)
    register_member(client, email="notify@semo.edu", student_id="77777777")

    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assert board is not None
    before = (
        db_session.query(InboxNotification)
        .filter(InboxNotification.member_id == board.id)
        .count()
    )
    assert before == 0

    token = _raw_token_for_email(db_session, "notify@semo.edu")
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200

    rows = (
        db_session.query(InboxNotification)
        .filter(InboxNotification.member_id == board.id)
        .all()
    )
    assert len(rows) == 1
    assert rows[0].type == "member_pending"


def test_resend_verification_is_idempotent_for_unknown_email(client):
    response = client.post(
        "/api/v1/auth/verify-email/resend",
        json={"email": "nobody@semo.edu"},
    )
    assert response.status_code == 200
    assert "link has been sent" in response.json()["message"].lower()


def test_invalid_verification_token_rejected(client):
    response = client.post(
        "/api/v1/auth/verify-email",
        json={"token": "not-a-real-token"},
    )
    assert response.status_code == 400


def test_registration_creates_verification_token(client, db_session):
    register_member(client, email="tokened@semo.edu", student_id="88888888")
    member = db_session.scalar(select(Member).where(Member.email == "tokened@semo.edu"))
    assert member is not None
    assert member.email_verified_at is None
    assert member.status == MemberStatus.PENDING

    tokens = db_session.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.member_id == member.id,
            EmailVerificationToken.used_at.is_(None),
        )
    ).all()
    assert len(tokens) == 1
    assert tokens[0].token_hash
    # Ensure we store a hash, not the raw secret.
    assert not verify_password("tokened@semo.edu", tokens[0].token_hash)


def test_skip_email_verification_puts_signup_in_pending(
    client, db_session, monkeypatch
):
    import app.core.config as config_module

    monkeypatch.setattr(config_module.settings, "SKIP_EMAIL_VERIFICATION", True)
    create_board_member(db_session)
    register_member(client, email="localdev@semo.edu", student_id="77777777")

    pending = client.get(
        "/api/v1/members/pending",
        headers=auth_header(client, email="board@semo.edu"),
    )
    assert pending.status_code == 200
    assert pending.json()["total"] == 1
    assert pending.json()["members"][0]["email"] == "localdev@semo.edu"

    login = login_member(client, email="localdev@semo.edu")
    assert login.status_code == 403
    assert login.json()["detail"] == "Member account is not approved"
