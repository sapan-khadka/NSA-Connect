from sqlalchemy import select

from app.core.security import decode_access_token
from app.models.member import Member, MemberStatus


def _register(client, email="sapan@semo.edu", password="securepass123"):
    return client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": email,
            "password": password,
        },
    )


def _approve_member(db_session, email="sapan@semo.edu"):
    member = db_session.scalar(select(Member).where(Member.email == email))
    member.status = MemberStatus.APPROVED
    db_session.commit()


def test_login_returns_jwt_for_approved_member(client, db_session):
    _register(client)
    _approve_member(db_session)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "sapan@semo.edu", "password": "securepass123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "expires_at" in data

    payload = decode_access_token(data["access_token"])
    assert payload["member_id"] == 1
    assert payload["email"] == "sapan@semo.edu"
    assert payload["role"] == "general"
    assert "exp" in payload


def test_login_rejects_invalid_password(client, db_session):
    _register(client)
    _approve_member(db_session)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "sapan@semo.edu", "password": "wrongpassword"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_rejects_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@semo.edu", "password": "securepass123"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_rejects_pending_member(client):
    _register(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "sapan@semo.edu", "password": "securepass123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Member account is not approved"


def test_login_rejects_non_semo_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "sapan@gmail.com", "password": "securepass123"},
    )

    assert response.status_code == 422
