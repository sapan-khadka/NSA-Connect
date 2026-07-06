"""Password change integration tests."""

from conftest import (
    auth_header,
    login_member,
    register_member,
    set_member_approved,
)


def test_register_rejects_common_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@semo.edu",
            "password": "password123",
            "student_id": "12345678",
            "major": "Computer Science",
            "graduation_year": 2028,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "This password is too common — choose something more unique"
    )


def test_register_rejects_password_with_email_local_part(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@semo.edu",
            "password": "sapanrocks",
            "student_id": "12345678",
            "major": "Computer Science",
            "graduation_year": 2028,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Password cannot contain your email address"


def test_change_password_rejects_short_password(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "short",
        },
    )

    assert response.status_code == 422


def test_change_password_rejects_common_password(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "password123",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "This password is too common — choose something more unique"
    )


def test_change_password_rejects_password_with_name(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "securepass123",
            "new_password": "khadka-river",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Password cannot contain your name"


def test_change_password_fails_with_wrong_current_password(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
        json={
            "current_password": "wrongpassword",
            "new_password": "river-canyon-9",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_change_password_succeeds_and_returns_new_tokens(client, db_session):
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
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me.status_code == 200

    old_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_access_token}"},
    )
    assert old_me.status_code == 401
    assert old_me.json()["detail"] == "Token has been revoked"


def test_change_password_old_refresh_token_rejected(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    login = login_member(client)
    old_refresh_token = login.json()["refresh_token"]
    headers = auth_header(client)

    response = client.post(
        "/api/v1/members/me/password",
        headers=headers,
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
