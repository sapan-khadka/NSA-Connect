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
    assert body["status"] == "submitted"


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
        json={"status": "internal_review"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "internal_review"
    assert body["noted_by"] is not None
    assert body["noted_at"] is not None


def test_board_can_approve_suggestion(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Approved idea",
        description="Ready for planning.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        json={"status": "internal_review"},
    )

    assert response.status_code == 403

    db_session.refresh(suggestion)
    assert suggestion.status == EventSuggestionStatus.SUBMITTED


def test_member_can_set_and_change_interest(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Picnic",
        description="Outdoor lunch.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
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


def test_board_can_convert_approved_idea(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Holi Night",
        description="Colors and music.",
        preferred_timing="Spring",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.APPROVED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/convert",
        headers=board_headers,
        json={
            "starts_at": "2030-03-15T18:00:00+00:00",
            "event_type": "cultural",
            "budget": "0.00",
            "location": "Student Center",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "converted"
    assert body["converted_event_id"] is not None

    event_response = client.get(
        f"/api/v1/events/{body['converted_event_id']}",
        headers=board_headers,
    )
    assert event_response.status_code == 200
    event = event_response.json()
    assert event["name"] == "Holi Night"
    assert event["description"] == "Colors and music."
    assert event["event_type"] == "cultural"
    assert event["location"] == "Student Center"


def test_cannot_convert_non_approved_idea(client, board_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Too early",
        description="Still cooking.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/convert",
        headers=board_headers,
        json={
            "starts_at": "2030-03-15T18:00:00+00:00",
            "event_type": "social",
            "budget": "0.00",
        },
    )
    assert response.status_code == 400


def test_viewing_idea_increments_unique_view_count(client, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Viewed idea",
        description="Track opens.",
        suggested_by_id=member.id,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    first = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )
    second = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )

    assert first.status_code == 200
    assert first.json()["view_count"] == 1
    assert second.status_code == 200
    assert second.json()["view_count"] == 1


def test_board_can_create_and_member_can_vote_poll(
    client, member_headers, board_headers, db_session
):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Poll idea",
        description="When?",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    create_response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/poll",
        headers=board_headers,
        json={
            "question": "Best night?",
            "options": ["Friday", "Saturday"],
        },
    )
    assert create_response.status_code == 201
    poll = create_response.json()
    option_id = poll["options"][0]["id"]

    vote_response = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/poll/vote",
        headers=member_headers,
        json={"option_id": option_id},
    )
    assert vote_response.status_code == 200
    assert vote_response.json()["my_option_id"] == option_id
    assert vote_response.json()["total_votes"] == 1

    activity = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/activity",
        headers=member_headers,
    )
    assert activity.status_code == 200
    assert any(item["kind"] == "poll" for item in activity.json()["items"])
    assert any(item["kind"] == "created" for item in activity.json()["items"])


def test_member_cannot_see_others_private_idea(
    client, member_headers, board_headers, db_session
):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Private board idea",
        description="Not published.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.SUBMITTED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    member_list = client.get("/api/v1/event-suggestions", headers=member_headers)
    assert member_list.status_code == 200
    assert all(row["id"] != suggestion.id for row in member_list.json()["suggestions"])

    member_detail = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )
    assert member_detail.status_code == 404

    board_detail = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=board_headers,
    )
    assert board_detail.status_code == 200


def test_board_publish_opens_community_feedback(client, board_headers, member_headers, db_session):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Publish me",
        description="Ask the members.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/status",
        headers=board_headers,
        json={"status": "published"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None

    vote = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "interested"},
    )
    assert vote.status_code == 200


def test_board_can_enable_discussion_on_published_idea(
    client, board_headers, member_headers, db_session
):
    """Older published ideas may have discussion off; enable path must flip it."""
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Comments off",
        description="Need enable path.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        community_discussion_enabled=False,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    blocked = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Cannot post yet"},
    )
    assert blocked.status_code == 400

    enabled = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=board_headers,
        json={
            "feedback_package": {
                "attendance_interest": True,
                "discussion": True,
                "preferred_semester": False,
                "transportation": False,
                "budget": False,
                "volunteer_interest": False,
            }
        },
    )
    assert enabled.status_code == 200
    assert enabled.json()["community_discussion_enabled"] is True

    posted = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Looks fun, but avoid finals week for transportation."},
    )
    assert posted.status_code == 201

    insight = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/community-insight",
        headers=board_headers,
    )
    assert insight.status_code == 200
    data = insight.json()
    assert data["comment_count"] >= 1
    assert isinstance(data["insights"], list)
    assert len(data["insights"]) >= 1


def test_board_can_close_community_feedback(client, board_headers, member_headers, db_session):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Close feedback",
        description="Lock responses before deciding.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    closed = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=board_headers,
        json={"community_feedback_closed": True},
    )
    assert closed.status_code == 200
    body = closed.json()
    assert body["community_feedback_closed_at"] is not None

    blocked = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "maybe"},
    )
    assert blocked.status_code == 400

    blocked_comment = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Too late to comment"},
    )
    assert blocked_comment.status_code == 400

    reopened = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=board_headers,
        json={"community_feedback_closed": False},
    )
    assert reopened.status_code == 200
    assert reopened.json()["community_feedback_closed_at"] is None

    vote = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/interest",
        headers=member_headers,
        json={"vote": "maybe"},
    )
    assert vote.status_code == 200


def test_cannot_approve_before_publish(client, board_headers, db_session):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Too soon",
        description="Still internal.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
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
    assert response.status_code == 400


def test_board_discussion_is_private(
    client, member_headers, board_headers, db_session
):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Internal talk",
        description="Board only thread.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    forbidden = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=member_headers,
    )
    assert forbidden.status_code == 403

    created = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=board_headers,
        json={"content": "Cost looks high for spring."},
    )
    assert created.status_code == 201
    assert created.json()["content"] == "Cost looks high for spring."

    listed = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=board_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    # Private idea: members cannot access it at all.
    hidden = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}",
        headers=member_headers,
    )
    assert hidden.status_code == 404

    # Community channel stays empty even for officers.
    community = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=board_headers,
    )
    assert community.status_code == 200
    assert community.json()["total"] == 0


def test_board_cannot_post_internal_before_review(client, board_headers, db_session):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Still submitted",
        description="No internal thread yet.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.SUBMITTED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=board_headers,
        json={"content": "Too early"},
    )
    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower()


def test_community_and_board_threads_stay_separate(
    client, member_headers, board_headers, db_session
):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Split threads",
        description="Two channels.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    community = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
        json={"content": "Public thought"},
    )
    assert community.status_code == 201

    board = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=board_headers,
        json={"content": "Private concern"},
    )
    assert board.status_code == 201

    community_list = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/comments",
        headers=member_headers,
    ).json()
    board_list = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/board-comments",
        headers=board_headers,
    ).json()

    assert community_list["total"] == 1
    assert community_list["comments"][0]["content"] == "Public thought"
    assert board_list["total"] == 1
    assert board_list["comments"][0]["content"] == "Private concern"


def test_publish_feedback_package_creates_polls(client, board_headers, db_session):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    suggestion = EventSuggestion(
        title="Package publish",
        description="Create presets.",
        suggested_by_id=board.id,
        status=EventSuggestionStatus.INTERNAL_REVIEW,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    response = client.patch(
        f"/api/v1/event-suggestions/{suggestion.id}/review",
        headers=board_headers,
        json={
            "status": "published",
            "feedback_package": {
                "attendance_interest": True,
                "preferred_semester": True,
                "transportation": True,
                "budget": False,
                "volunteer_interest": False,
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "published"

    polls = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/polls",
        headers=board_headers,
    )
    assert polls.status_code == 200
    body = polls.json()["polls"]
    questions = {row["question"] for row in body}
    assert "Preferred semester?" in questions
    assert "Transportation" in questions
    assert len(body) == 2


def test_can_create_multiple_polls(client, board_headers, member_headers, db_session):
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    suggestion = EventSuggestion(
        title="Multi poll",
        description="Many questions.",
        suggested_by_id=member.id,
        status=EventSuggestionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    first = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/polls",
        headers=board_headers,
        json={"question": "Best night?", "options": ["Friday", "Saturday"]},
    )
    second = client.post(
        f"/api/v1/event-suggestions/{suggestion.id}/polls",
        headers=board_headers,
        json={"question": "Food?", "options": ["Dinner", "Snacks"]},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    listed = client.get(
        f"/api/v1/event-suggestions/{suggestion.id}/polls",
        headers=member_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()["polls"]) == 2

    poll_id = second.json()["id"]
    option_id = second.json()["options"][0]["id"]
    vote = client.put(
        f"/api/v1/event-suggestions/{suggestion.id}/polls/{poll_id}/vote",
        headers=member_headers,
        json={"option_id": option_id},
    )
    assert vote.status_code == 200
    assert vote.json()["id"] == poll_id
    assert vote.json()["my_option_id"] == option_id
