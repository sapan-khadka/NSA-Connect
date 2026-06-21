"""Auth edge-case tests — register, login, bad domain, wrong password."""

from conftest import (
    BAD_DOMAIN_EMAIL,
    approve_member,
    login_member,
    register_member,
)

from app.core.security import decode_access_token


def test_register_creates_pending_member(client):
    response = register_member(client)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "sapan@semo.edu"
    assert data["status"] == "pending"
    assert data["role"] == "general"
    assert "password" not in data


def test_login_returns_jwt_for_approved_member(client, db_session):
    register_member(client)
    approve_member(db_session)

    response = login_member(client)

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data

    payload = decode_access_token(data["access_token"])
    assert payload["email"] == "sapan@semo.edu"
    assert payload["member_id"] == 1


def test_register_rejects_non_semo_domain(client):
    response = register_member(client, email=BAD_DOMAIN_EMAIL)

    assert response.status_code == 422


def test_login_rejects_non_semo_domain(client):
    response = login_member(client, email=BAD_DOMAIN_EMAIL)

    assert response.status_code == 422


def test_login_rejects_wrong_password(client, db_session):
    register_member(client)
    approve_member(db_session)

    response = login_member(client, password="wrongpassword")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_register_rejects_duplicate_email(client):
    register_member(client)
    response = register_member(client)

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"
