from sqlalchemy import select

from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.core.security import hash_password
from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member, MemberStatus

VALID_EMAIL = "sapan@semo.edu"


def _add_pending_member(db_session) -> Member:
    pending = Member(
        full_name="Pending User",
        email="pending@semo.edu",
        student_id="11111111",
        major="CS",
        graduation_year=2028,
        hashed_password=hash_password("Password1!"),
        status=MemberStatus.PENDING,
    )
    db_session.add(pending)
    db_session.commit()
    db_session.refresh(pending)
    return pending


def test_general_member_summary_zeros_board_counts(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    member = db_session.scalar(select(Member).where(Member.email == VALID_EMAIL))
    assert member is not None

    _add_pending_member(db_session)
    db_session.add(
        EventSuggestion(
            title="Hack night",
            description="Build something",
            status=EventSuggestionStatus.SUBMITTED,
            suggested_by_id=member.id,
        )
    )
    db_session.commit()

    response = client.get(
        "/api/v1/notifications/summary",
        headers=auth_header(client),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["members_pending"] == 0
    assert body["finance_pending"] == 0
    assert body["suggestions_pending"] == 0
    assert body["discussions_unread"] == 0
    assert body["tasks_overdue"] == 0
    assert body["tasks_due_today"] == 0
    assert body["attention_total"] == 0


def test_board_summary_includes_pending_members_and_suggestions(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    board = create_board_member(db_session)
    set_member_approved(db_session, email="other@semo.edu")

    _add_pending_member(db_session)
    db_session.add(
        EventSuggestion(
            title="Hack night",
            description="Build something",
            status=EventSuggestionStatus.SUBMITTED,
            suggested_by_id=board.id,
        )
    )
    db_session.add(
        EventSuggestion(
            title="Already noted",
            description="Done",
            status=EventSuggestionStatus.NOTED,
            suggested_by_id=board.id,
        )
    )
    db_session.commit()

    response = client.get(
        "/api/v1/notifications/summary",
        headers=auth_header(client, email="board@semo.edu"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["members_pending"] == 1
    assert body["suggestions_pending"] == 1
    assert body["finance_pending"] == 0
    assert body["attention_total"] >= 2


def test_summary_requires_auth(client):
    response = client.get("/api/v1/notifications/summary")
    assert response.status_code == 401
