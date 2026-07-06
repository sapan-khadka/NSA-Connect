from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member
from conftest import auth_header, create_board_member, register_member, set_member_approved


@pytest.fixture
def board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def test_any_member_can_submit_suggestion(client, member_headers):
    response = client.post(
        "/api/v1/event-suggestions",
        headers=member_headers,
        json={
            "title": "Holi celebration",
            "description": "Color festival with food and music.",
            "preferred_timing": "This semester",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Holi celebration"
    assert body["preferred_timing"] == "This semester"
    assert body["status"] == "submitted"
    assert body["suggested_by"]["full_name"]


def test_member_can_submit_without_preferred_timing(client, member_headers):
    response = client.post(
        "/api/v1/event-suggestions",
        headers=member_headers,
        json={
            "title": "Study night",
            "description": "Quiet group study session.",
        },
    )

    assert response.status_code == 201
    assert response.json()["preferred_timing"] is None


def test_all_members_can_list_suggestions(client, member_headers, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    db_session.add(
        EventSuggestion(
            title="Existing idea",
            description="Already submitted.",
            suggested_by_id=member.id,
            created_at=datetime.now(UTC),
        ),
    )
    db_session.commit()

    member_response = client.get("/api/v1/event-suggestions", headers=member_headers)
    board_response = client.get("/api/v1/event-suggestions", headers=board_headers)

    assert member_response.status_code == 200
    assert board_response.status_code == 200
    assert member_response.json()["total"] == 1
    assert member_response.json()["suggestions"][0]["title"] == "Existing idea"


def test_board_can_mark_suggestion_noted(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Board social",
        description="Casual meetup.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/status",
        headers=board_headers,
        json={"status": "noted"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "noted"
    assert body["noted_by"] is not None
    assert body["noted_at"] is not None


def test_member_cannot_mark_suggestion_noted(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Game night",
        description="Board games.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/status",
        headers=member_headers,
        json={"status": "noted"},
    )

    assert response.status_code == 403

    db_session.refresh(suggestion)
    assert suggestion.status == EventSuggestionStatus.SUBMITTED
