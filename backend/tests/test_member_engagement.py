from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.lib.semester import get_current_semester_slug
from app.models.event_checkin import EventCheckIn
from app.models.event_suggestion import EventSuggestion
from app.models.event_task import EventTask, EventTaskStatus
from app.models.member import Member
from app.models.member_dues import MemberDues


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night.",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def president_headers(client, db_session):
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def active_member(client, db_session):
    register_member(client, email="active@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="active@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "active@semo.edu"))


@pytest.fixture
def idle_member(client, db_session):
    register_member(client, email="idle@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="idle@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "idle@semo.edu"))


def test_engagement_requires_board(client, db_session, active_member):
    headers = auth_header(client, email="active@semo.edu")
    response = client.get("/api/v1/members/engagement", headers=headers)
    assert response.status_code == 403


def test_engagement_marks_paid_dues_active_and_others_idle(
    client,
    db_session,
    board_headers,
    active_member,
    idle_member,
):
    semester = get_current_semester_slug()
    db_session.add(
        MemberDues(
            member_id=active_member.id,
            semester=semester,
            amount_owed=Decimal("20.00"),
            amount_paid=Decimal("20.00"),
            paid_at=datetime.now(UTC),
        )
    )
    db_session.commit()

    response = client.get("/api/v1/members/engagement", headers=board_headers)
    assert response.status_code == 200
    body = response.json()

    by_id = {row["member_id"]: row for row in body["members"]}
    assert by_id[active_member.id]["status"] == "active"
    assert by_id[active_member.id]["signals"]["paid_dues"] is True
    assert by_id[idle_member.id]["status"] == "idle"
    assert body["active_count"] >= 1
    assert body["idle_count"] >= 1


def test_engagement_marks_checkin_and_suggestion_active(
    client,
    db_session,
    president_headers,
    board_headers,
    active_member,
    idle_member,
):
    event_response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=president_headers,
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    db_session.add(
        EventCheckIn(
            event_id=event_id,
            member_id=active_member.id,
            checked_in_at=datetime.now(UTC) - timedelta(days=3),
        )
    )
    db_session.add(
        EventSuggestion(
            title="Holí night",
            description="Color festival on the quad.",
            suggested_by_id=idle_member.id,
            created_at=datetime.now(UTC) - timedelta(days=2),
        )
    )
    db_session.commit()

    response = client.get("/api/v1/members/engagement", headers=board_headers)
    assert response.status_code == 200
    by_id = {row["member_id"]: row for row in response.json()["members"]}

    assert by_id[active_member.id]["status"] == "active"
    assert by_id[active_member.id]["signals"]["attended_event"] is True
    assert by_id[idle_member.id]["status"] == "active"
    assert by_id[idle_member.id]["signals"]["shared_suggestion"] is True


def test_engagement_marks_in_progress_task_active(
    client,
    db_session,
    president_headers,
    board_headers,
    idle_member,
):
    event_response = client.post(
        "/api/v1/events",
        json=_event_payload(name="Task Night"),
        headers=president_headers,
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    db_session.add(
        EventTask(
            event_id=event_id,
            title="Bring snacks",
            assignee_id=idle_member.id,
            status=EventTaskStatus.IN_PROGRESS,
            created_by_id=idle_member.id,
        )
    )
    db_session.commit()

    response = client.get("/api/v1/members/engagement", headers=board_headers)
    assert response.status_code == 200
    by_id = {row["member_id"]: row for row in response.json()["members"]}
    assert by_id[idle_member.id]["status"] == "active"
    assert by_id[idle_member.id]["signals"]["in_progress_task"] is True
