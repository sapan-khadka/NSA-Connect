from sqlalchemy import select

from app.core.security import verify_password
from app.models.member import Member

from conftest import (
    VALID_GRADUATION_YEAR,
    VALID_MAJOR,
    VALID_STUDENT_ID,
    register_payload,
)


def test_register_creates_member(client):
    response = client.post("/api/v1/auth/register", json=register_payload())

    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Sapan Khadka"
    assert data["email"] == "sapan@semo.edu"
    assert data["student_id"] == VALID_STUDENT_ID
    assert data["major"] == VALID_MAJOR
    assert data["graduation_year"] == VALID_GRADUATION_YEAR
    assert data["role"] == "general"
    assert data["status"] == "pending"
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_hashes_password(client, db_session):
    client.post("/api/v1/auth/register", json=register_payload())

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))

    assert member.hashed_password != "securepass123"
    assert verify_password("securepass123", member.hashed_password)


def test_register_rejects_duplicate_email(client):
    payload = register_payload()

    first = client.post("/api/v1/auth/register", json=payload)
    second = client.post("/api/v1/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Email already registered"


def test_register_rejects_duplicate_student_id(client):
    first = client.post("/api/v1/auth/register", json=register_payload())
    second = client.post(
        "/api/v1/auth/register",
        json=register_payload(email="other@semo.edu"),
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Student ID already registered"


def test_register_rejects_non_semo_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(email="sapan@gmail.com"),
    )

    assert response.status_code == 422


def test_register_rejects_short_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(password="short"),
    )

    assert response.status_code == 422


def test_register_rejects_invalid_student_id(client):
    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(student_id="bad-id!"),
    )

    assert response.status_code == 422


def test_register_accepts_semo_student_id_with_letter(client):
    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(student_id="s12345678"),
    )

    assert response.status_code == 201
    assert response.json()["student_id"] == "S12345678"


def test_register_rejects_past_graduation_year(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            **register_payload(),
            "graduation_year": 2020,
        },
    )

    assert response.status_code == 422
