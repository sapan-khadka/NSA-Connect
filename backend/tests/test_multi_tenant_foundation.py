"""Smoke tests for Phase 1 multi-tenant foundation (single org: NSA)."""

import pytest
from sqlalchemy import select

from app.core.permissions import Permission, member_has
from app.core.validators import university_for_email, validate_university_email
from app.models.event import Event
from app.models.member import MemberRole, MemberStatus
from app.models.organization import Organization
from app.models.organization_membership import OrganizationMembership
from app.models.university import University
from app.services.organization_context import (
    ensure_nsa_org_owner,
    get_default_organization_id,
    get_membership_for_user,
    resolve_organization_id,
)
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
)


def test_default_university_and_org_seeded(db_session):
    university = db_session.scalar(
        select(University).where(University.slug == "semo")
    )
    organization = db_session.scalar(
        select(Organization).where(Organization.slug == "nsa")
    )
    assert university is not None
    assert organization is not None
    assert organization.university_id == university.id
    assert get_default_organization_id(db_session) == organization.id
    assert university.email_domain == "semo.edu"


def test_board_member_has_default_org_membership(db_session):
    member = create_board_member(db_session)
    membership = get_membership_for_user(db_session, member.id)
    assert membership is not None
    assert membership.organization_id == get_default_organization_id(db_session)
    assert membership.role == member.role
    assert membership.status == member.status


def test_created_event_is_scoped_to_default_org(client, db_session):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    response = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "name": "Tenant Fest",
            "starts_at": "2030-11-01T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Scoped event",
            "budget": "100.00",
        },
    )
    assert response.status_code == 201
    event_id = response.json()["id"]

    event = db_session.get(Event, event_id)
    assert event is not None
    assert event.organization_id == get_default_organization_id(db_session)


def test_auth_me_includes_organization(client, db_session):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["organization"]["slug"] == "nsa"
    assert body["organization"]["name"]

    memberships = list(
        db_session.scalars(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == body["id"]
            )
        ).all()
    )
    assert len(memberships) == 1


def test_university_email_domain_validation(db_session):
    assert validate_university_email(db_session, "student@semo.edu") == "student@semo.edu"
    university = university_for_email(db_session, "student@semo.edu")
    assert university is not None
    assert university.slug == "semo"

    with pytest.raises(ValueError, match="@semo.edu"):
        validate_university_email(db_session, "student@gmail.com")


def test_president_seeded_as_org_owner(db_session):
    president = create_president_member(db_session)
    membership = get_membership_for_user(db_session, president.id)
    assert membership is not None
    assert membership.is_org_owner is True
    assert membership.role == MemberRole.PRESIDENT

    # Idempotent bootstrap
    again = ensure_nsa_org_owner(db_session)
    assert again is not None
    assert again.id == membership.id


def test_membership_is_auth_authority_for_permissions(client, db_session):
    president = create_president_member(db_session)
    headers = auth_header(client, email="president@semo.edu")
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200

    # Simulate request-scoped membership (as get_current_member does).
    membership = get_membership_for_user(db_session, president.id)
    president._active_membership = membership
    president._active_organization_id = membership.organization_id

    assert member_has(president, Permission.MANAGE_MEMBERS)
    assert member_has(president, Permission.MANAGE_TASKS)
    assert member_has(president, Permission.TRANSFER_OWNERSHIP)
    assert resolve_organization_id(db_session, president) == membership.organization_id


def test_sync_membership_preserves_is_org_owner(db_session):
    from app.services.organization_context import sync_membership_from_member

    president = create_president_member(db_session)
    membership = get_membership_for_user(db_session, president.id)
    assert membership.is_org_owner is True

    president.status = MemberStatus.APPROVED
    sync_membership_from_member(db_session, president)
    db_session.commit()
    db_session.refresh(membership)
    assert membership.is_org_owner is True


def test_empty_org_first_register_becomes_owner(client, db_session):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "First Owner",
            "email": "first-owner@semo.edu",
            "password": "securepass123",
            "student_id": "10000001",
            "major": "Computer Science",
            "graduation_year": 2028,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"
    assert body["role"] == "president"

    membership = get_membership_for_user(db_session, body["id"])
    assert membership is not None
    assert membership.is_org_owner is True
    assert membership.role == MemberRole.PRESIDENT

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "first-owner@semo.edu", "password": "securepass123"},
    )
    assert login.status_code == 200


def test_register_stays_pending_when_approved_members_exist(client, db_session):
    create_board_member(db_session)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Later Member",
            "email": "later@semo.edu",
            "password": "securepass123",
            "student_id": "10000002",
            "major": "Computer Science",
            "graduation_year": 2028,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["role"] == "general"

    membership = get_membership_for_user(db_session, body["id"])
    assert membership is not None
    assert membership.is_org_owner is False
    assert membership.status == MemberStatus.PENDING
