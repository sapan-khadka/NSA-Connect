"""Smoke tests for Phase 1 multi-tenant foundation (single org: NSA)."""

from sqlalchemy import select

from app.models.event import Event
from app.models.organization import Organization
from app.models.organization_membership import OrganizationMembership
from app.models.university import University
from app.services.organization_context import (
    get_default_organization_id,
    get_membership_for_user,
)
from conftest import auth_header, create_board_member


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
