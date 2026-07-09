"""JWT refresh flow and token revocation tests."""

from datetime import UTC, datetime, timedelta

import jwt
from conftest import login_member, register_member, set_member_approved
from sqlalchemy import select

from app.core.config import settings
from app.core.security import JWT_ALGORITHM, TokenType
from app.models.member import Member, MemberStatus


def test_login_returns_refresh_token(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    response = login_member(client)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "refresh_expires_at" in data


def test_refresh_issues_new_access_token(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    login = login_member(client)
    refresh_token = login.json()["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me.status_code == 200


def test_expired_access_token_rejected(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    expired_payload = {
        "member_id": 1,
        "email": "sapan@semo.edu",
        "role": "general",
        "tv": 1,
        "typ": TokenType.ACCESS.value,
        "exp": datetime.now(UTC) - timedelta(minutes=1),
    }
    expired_token = jwt.encode(
        expired_payload,
        settings.SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


def test_old_access_token_rejected_after_password_change(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    login = login_member(client)
    old_access_token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {old_access_token}"}

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "river-canyon-9",
        },
    )
    assert response.status_code == 200

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 401
    assert me.json()["detail"] == "Token has been revoked"


def test_old_refresh_token_rejected_after_password_change(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    login = login_member(client)
    old_refresh_token = login.json()["refresh_token"]
    access_token = login.json()["access_token"]

    response = client.post(
        "/api/v1/members/me/password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "current_password": "securepass123",
            "new_password": "river-canyon-9",
        },
    )
    assert response.status_code == 200

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh.status_code == 401
    assert refresh.json()["detail"] == "Refresh token has been revoked"


def test_rejected_member_token_rejected(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    login = login_member(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    member.status = MemberStatus.REJECTED
    member.token_version = (member.token_version or 1) + 1
    db_session.commit()

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Token has been revoked"
