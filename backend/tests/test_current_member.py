from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.security import JWT_ALGORITHM, create_access_token
from app.models.member import Member, MemberStatus


from conftest import register_payload


def _register(client, email="sapan@semo.edu", password="securepass123"):
    return client.post(
        "/api/v1/auth/register",
        json=register_payload(email=email, password=password),
    )


def _approve_member(db_session, email="sapan@semo.edu"):
    member = db_session.scalar(select(Member).where(Member.email == email))
    member.status = MemberStatus.APPROVED
    db_session.commit()


def _login(client, email="sapan@semo.edu", password="securepass123"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def test_me_returns_current_member(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "sapan@semo.edu"
    assert data["role"] == "general"
    assert data["status"] == "approved"


def test_me_rejects_missing_token(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_rejects_invalid_token(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


def test_me_rejects_expired_token(client, db_session):
    _register(client)
    _approve_member(db_session)

    expired_payload = {
        "member_id": 1,
        "email": "sapan@semo.edu",
        "role": "general",
        "tv": 1,
        "typ": "access",
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


def test_me_rejects_unapproved_member_with_valid_token(client, db_session):
    _register(client)

    token, _ = create_access_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
        token_version=1,
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Member account is not approved"


def test_members_me_returns_own_profile(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/members/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "sapan@semo.edu"
    assert data["full_name"] == "Sapan Khadka"
    assert data["student_id"] == "12345678"
    assert data["major"] == "Computer Science"
    assert data["graduation_year"] == 2028
    assert data["role"] == "general"
    assert data["status"] == "approved"
    assert "password" not in data
    assert "hashed_password" not in data


def test_members_me_rejects_missing_token(client):
    response = client.get("/api/v1/members/me")

    assert response.status_code == 401


def test_members_me_rejects_unapproved_member(client, db_session):
    _register(client)

    token, _ = create_access_token(
        member_id=1,
        email="sapan@semo.edu",
        role="general",
        token_version=1,
    )

    response = client.get(
        "/api/v1/members/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Member account is not approved"


def test_members_me_password_changes_password(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "river-canyon-9",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()

    old_login = _login(client)
    assert old_login.status_code == 401

    new_login = _login(client, password="river-canyon-9")
    assert new_login.status_code == 200


def test_members_me_password_rejects_wrong_current_password(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/members/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "wrongpassword",
            "new_password": "river-canyon-9",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_members_me_password_changes_password(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "river-canyon-9",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()

    old_login = _login(client)
    assert old_login.status_code == 401

    new_login = _login(client, password="river-canyon-9")
    assert new_login.status_code == 200


def test_members_me_password_rejects_wrong_current_password(client, db_session):
    _register(client)
    _approve_member(db_session)
    login = _login(client)
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/members/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "wrongpassword",
            "new_password": "river-canyon-9",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"
