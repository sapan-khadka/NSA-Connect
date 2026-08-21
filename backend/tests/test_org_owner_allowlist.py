"""Org-owner allowlist: Gmail head + SEMO members."""

import pytest
from conftest import (
    VALID_PASSWORD,
    login_member,
    mark_email_verified,
    register_member,
    register_payload,
)
from sqlalchemy import select

import app.core.config as config_module
from app.models.member import Member, MemberRole, MemberStatus
from app.models.organization_membership import OrganizationMembership
from app.services.organization_context import get_default_organization_id

OWNER_EMAIL = "nsa.connect@gmail.com"
RANDOM_GMAIL = "random.person@gmail.com"


@pytest.fixture
def org_owner_allowlist(monkeypatch):
    # Patch the live module settings object (conftest replaces it each test).
    monkeypatch.setattr(config_module.settings, "ORG_OWNER_EMAILS", OWNER_EMAIL)


@pytest.mark.empty_org
def test_allowlisted_owner_registers_as_approved_owner(
    client, db_session, org_owner_allowlist
):
    response = client.post(
        "/api/v1/auth/register",
        json={
            **register_payload(email=OWNER_EMAIL, student_id=None),
            "student_id": None,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == OWNER_EMAIL
    assert data["status"] == "approved"
    assert data["role"] == "general"
    assert data["student_id"] is None

    membership = db_session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == data["id"],
            OrganizationMembership.organization_id == get_default_organization_id(db_session),
        ),
    )
    assert membership is not None
    assert membership.is_org_owner is True
    assert membership.role == MemberRole.GENERAL


@pytest.mark.empty_org
def test_allowlisted_owner_can_login(client, db_session, org_owner_allowlist):
    client.post(
        "/api/v1/auth/register",
        json={
            **register_payload(email=OWNER_EMAIL, student_id=None),
            "student_id": None,
        },
    )
    mark_email_verified(db_session, email=OWNER_EMAIL)

    response = login_member(client, email=OWNER_EMAIL, password=VALID_PASSWORD)
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.empty_org
def test_random_gmail_rejected_when_allowlist_configured(client, org_owner_allowlist):
    response = register_member(client, email=RANDOM_GMAIL)
    assert response.status_code == 422


@pytest.mark.empty_org
def test_semo_stays_pending_when_owner_allowlist_configured(
    client, db_session, org_owner_allowlist
):
    response = register_member(client)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["role"] == "general"

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    assert member is not None
    assert member.status == MemberStatus.PENDING
    assert member.role == MemberRole.GENERAL

    membership = db_session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == member.id,
        ),
    )
    assert membership is not None
    assert membership.is_org_owner is False


@pytest.mark.empty_org
def test_owner_then_semo_pending_and_owner_approves(
    client, db_session, org_owner_allowlist
):
    owner = client.post(
        "/api/v1/auth/register",
        json={
            **register_payload(email=OWNER_EMAIL, student_id=None),
            "student_id": None,
        },
    )
    assert owner.status_code == 201
    mark_email_verified(db_session, email=OWNER_EMAIL)

    student = register_member(client, email="board.candidate@semo.edu", student_id="87654321")
    assert student.status_code == 201
    assert student.json()["status"] == "pending"
    student_id = student.json()["id"]
    mark_email_verified(db_session, email="board.candidate@semo.edu")

    token = login_member(client, email=OWNER_EMAIL, password=VALID_PASSWORD).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}

    approve = client.patch(
        f"/api/v1/members/{student_id}/approve",
        headers=headers,
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    promote = client.patch(
        f"/api/v1/members/{student_id}/role",
        json={"role": "board"},
        headers=headers,
    )
    assert promote.status_code == 200
    assert promote.json()["role"] == "board"


def test_semo_without_student_id_rejected(client, org_owner_allowlist):
    response = client.post(
        "/api/v1/auth/register",
        json={
            **register_payload(student_id=None),
            "student_id": None,
        },
    )
    assert response.status_code == 422
