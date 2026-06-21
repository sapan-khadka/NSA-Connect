from sqlalchemy import select

from app.core.security import verify_password
from app.models.member import Member


def test_register_creates_member(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@semo.edu",
            "password": "securepass123",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Sapan Khadka"
    assert data["email"] == "sapan@semo.edu"
    assert data["role"] == "general"
    assert data["status"] == "pending"
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_hashes_password(client, db_session):
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@semo.edu",
            "password": "securepass123",
        },
    )

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))

    assert member.hashed_password != "securepass123"
    assert verify_password("securepass123", member.hashed_password)


def test_register_rejects_duplicate_email(client):
    payload = {
        "full_name": "Sapan Khadka",
        "email": "sapan@semo.edu",
        "password": "securepass123",
    }

    first = client.post("/api/v1/auth/register", json=payload)
    second = client.post("/api/v1/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Email already registered"


def test_register_rejects_non_semo_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@gmail.com",
            "password": "securepass123",
        },
    )

    assert response.status_code == 422


def test_register_rejects_short_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Sapan Khadka",
            "email": "sapan@semo.edu",
            "password": "short",
        },
    )

    assert response.status_code == 422
