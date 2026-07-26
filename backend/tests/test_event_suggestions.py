from datetime import UTC, datetime

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member


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
    assert body["status"] == "pending_review"
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


def test_all_members_can_list_suggestions(
    client, member_headers, board_headers, db_session
):
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


def test_member_can_get_suggestion_detail(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Cultural night",
        description="Music and food.",
        preferred_timing="Fall",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == suggestion.id
    assert body["title"] == "Cultural night"
    assert body["status"] == "pending_review"


def test_get_missing_suggestion_returns_404(client, member_headers):
    response = client.get("/api/v1/event-suggestions/99999", headers=member_headers)
    assert response.status_code == 404


def test_board_can_open_suggestion_for_discussion(client, board_headers, db_session):
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
        json={"status": "under_discussion"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "under_discussion"
    assert body["noted_by"] is not None
    assert body["noted_at"] is not None


def test_board_can_approve_suggestion(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Approved idea",
        description="Ready for planning.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.UNDER_DISCUSSION,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/status",
        headers=board_headers,
        json={"status": "approved"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_member_cannot_update_suggestion_status(client, member_headers, db_session):
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
        json={"status": "under_discussion"},
    )

    assert response.status_code == 403

    db_session.refresh(suggestion)
    assert suggestion.status == EventSuggestionStatus.PENDING_REVIEW


def test_member_can_set_and_change_interest(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Picnic",
        description="Outdoor lunch.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    set_response = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "interested"},
    )
    assert set_response.status_code == 200
    body = set_response.json()
    assert body["my_interest"] == "interested"
    assert body["interest_counts"]["interested"] == 1
    assert body["interest_counts"]["maybe"] == 0

    change_response = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "maybe"},
    )
    assert change_response.status_code == 200
    changed = change_response.json()
    assert changed["my_interest"] == "maybe"
    assert changed["interest_counts"]["interested"] == 0
    assert changed["interest_counts"]["maybe"] == 1


def test_member_can_clear_interest(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Movie night",
        description="Campus screening.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "not_interested"},
    )
    clear_response = client.delete(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
    )

    assert clear_response.status_code == 200
    body = clear_response.json()
    assert body["my_interest"] is None
    assert body["interest_counts"]["not_interested"] == 0


def test_interest_closed_for_rejected_idea(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Rejected idea",
        description="Not moving forward.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.REJECTED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "interested"},
    )

    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower()


def test_member_can_comment_and_reply(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Discussion idea",
        description="Talk it through.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    create_response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "I like this timing."},
    )
    assert create_response.status_code == 201
    parent = create_response.json()
    assert parent["content"] == "I like this timing."
    assert parent["parent_id"] is None
    assert parent["can_delete"] is True

    reply_response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Same here.", "parent_id": parent["id"]},
    )
    assert reply_response.status_code == 201
    assert reply_response.json()["parent_id"] == parent["id"]

    list_response = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
    )
    assert list_response.status_code == 200
    body = list_response.json()
    assert body["total"] == 2
    assert len(body["comments"]) == 1
    assert len(body["comments"][0]["replies"]) == 1
    assert body["comments"][0]["replies"][0]["content"] == "Same here."


def test_member_can_soft_delete_own_comment(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Delete comment idea",
        description="Cleanup.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    created = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Temporary thought"},
    ).json()

    delete_response = client.delete(
        f"/api/v1/event-suggestions/{suggestion.id}/comments/{created['id']}",
        headers=member_headers,
    )
    assert delete_response.status_code == 200
    body = delete_response.json()
    assert body["is_deleted"] is True
    assert body["content"] == "This comment was deleted"
    assert body["can_delete"] is False


def test_cannot_reply_to_a_reply(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Depth limit",
        description="One level only.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    parent = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Top level"},
    ).json()
    reply = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Reply", "parent_id": parent["id"]},
    ).json()

    nested = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Too deep", "parent_id": reply["id"]},
    )
    assert nested.status_code == 400


def test_discussion_closed_for_archived_idea(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Archived idea",
        description="Closed.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.ARCHIVED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Should not post"},
    )
    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower()


def test_board_can_review_with_note_and_approve(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Reviewable idea",
        description="Needs a decision.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=board_headers,
        json={
            "status": "approved",
            "board_note": "Strong interest. Plan for fall.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["board_note"] == "Strong interest. Plan for fall."
    assert body["can_board_review"] is True
    assert body["noted_by"] is not None


def test_member_cannot_see_board_note(client, member_headers, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Private note idea",
        description="Board only note.",
        suggested_by_id=member.id,
        board_note="Internal concern",
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    member_response = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )
    board_response = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=board_headers,
    )

    assert member_response.status_code == 200
    assert member_response.json()["board_note"] is None
    assert member_response.json()["can_board_review"] is False
    assert board_response.status_code == 200
    assert board_response.json()["board_note"] == "Internal concern"
    assert board_response.json()["can_board_review"] is True


def test_member_cannot_board_review(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="No access",
        description="Members cannot review.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=member_headers,
        json={"status": "approved"},
    )
    assert response.status_code == 403
