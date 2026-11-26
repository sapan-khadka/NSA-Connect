"""Planned event budgets stay off general-member event reads."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    create_president_member,
    create_treasurer_member,
    create_vice_president_member,
    register_member,
    set_member_approved,
)

from app.models.event import Event, EventType
from app.services.organization_context import (
    get_default_organization_id,
    get_membership_for_user,
)


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night with food and performances.",
        "location": "University Center",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client, email="budget-general@semo.edu", student_id="81000001")
    set_member_approved(db_session, email="budget-general@semo.edu")
    return auth_header(client, email="budget-general@semo.edu")


@pytest.fixture
def board_member_headers(client, db_session):
    create_board_member(
        db_session,
        email="budget-board@semo.edu",
        student_id="81000002",
    )
    return auth_header(client, email="budget-board@semo.edu", password=VALID_PASSWORD)


def _create_event(client, headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["budget"] == "250.00"
    return body["id"]


def _seed_past_event(db_session, created_by_id: int) -> int:
    event = Event(
        title="Past Cultural Night",
        description="Already happened",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2020, 6, 1, tzinfo=UTC),
        location="University Center",
        budget=Decimal("880.00"),
        created_by_id=created_by_id,
        organization_id=get_default_organization_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event.id


def test_general_member_event_reads_omit_planned_budget(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    event_id = _create_event(client, board_member_headers)
    board = client.get("/api/v1/auth/me", headers=board_member_headers).json()
    past_id = _seed_past_event(db_session, board["id"])

    listed = client.get("/api/v1/events", headers=general_member_headers)
    upcoming = client.get("/api/v1/events/upcoming", headers=general_member_headers)
    past = client.get("/api/v1/events/past", headers=general_member_headers)
    detail = client.get(f"/api/v1/events/{event_id}", headers=general_member_headers)
    past_detail = client.get(
        f"/api/v1/events/{past_id}",
        headers=general_member_headers,
    )

    assert listed.status_code == 200
    assert upcoming.status_code == 200
    assert past.status_code == 200
    assert detail.status_code == 200
    assert past_detail.status_code == 200

    listed_event = next(item for item in listed.json()["events"] if item["id"] == event_id)
    upcoming_event = next(
        item for item in upcoming.json()["events"] if item["id"] == event_id
    )
    past_event = next(item for item in past.json()["events"] if item["id"] == past_id)
    for payload in (
        listed_event,
        upcoming_event,
        past_event,
        detail.json(),
        past_detail.json(),
    ):
        assert payload["name"]
        assert payload["location"] == "University Center"
        assert payload["budget"] is None
        assert "250" not in str(payload["budget"])
        assert "880" not in str(payload["budget"])


@pytest.mark.parametrize(
    ("factory", "email", "student_id"),
    [
        (create_board_member, "viewer-board@semo.edu", "81000003"),
        (create_treasurer_member, "viewer-treasurer@semo.edu", "81000004"),
        (create_vice_president_member, "viewer-vp@semo.edu", "81000005"),
        (create_president_member, "viewer-president@semo.edu", "81000006"),
    ],
)
def test_finance_viewers_still_receive_planned_budget(
    client,
    db_session,
    board_member_headers,
    factory,
    email,
    student_id,
):
    event_id = _create_event(client, board_member_headers)
    factory(db_session, email=email, student_id=student_id, password=VALID_PASSWORD)
    headers = auth_header(client, email=email, password=VALID_PASSWORD)
    detail = client.get(f"/api/v1/events/{event_id}", headers=headers)
    listed = client.get("/api/v1/events", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["budget"] == "250.00"
    match = next(item for item in listed.json()["events"] if item["id"] == event_id)
    assert match["budget"] == "250.00"


def test_org_owner_still_receives_planned_budget(
    client,
    db_session,
    board_member_headers,
):
    event_id = _create_event(client, board_member_headers)
    register_member(client, email="viewer-owner@semo.edu", student_id="81000007")
    set_member_approved(db_session, email="viewer-owner@semo.edu")
    headers = auth_header(client, email="viewer-owner@semo.edu")
    member = client.get("/api/v1/auth/me", headers=headers).json()
    membership = get_membership_for_user(db_session, member["id"])
    membership.is_org_owner = True
    db_session.commit()

    detail = client.get(f"/api/v1/events/{event_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["budget"] == "250.00"
    assert detail.json()["name"] == "Dashain Celebration"
