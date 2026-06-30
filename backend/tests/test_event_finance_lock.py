import pytest
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from conftest import (
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
)
from app.lib.event_finance import (
    FINANCE_EDIT_GRACE_PERIOD,
    get_event_finance_lock_at,
    is_event_finance_locked,
)
from app.models.event import Event, EventType
from app.models.member import Member


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
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def treasurer_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


def get_board_member_id(db_session) -> int:
    member = db_session.scalar(
        select(Member).where(Member.email == "board@semo.edu"),
    )
    assert member is not None
    return member.id


def get_treasurer_member_id(db_session) -> int:
    member = db_session.scalar(
        select(Member).where(Member.email == "treasurer@semo.edu"),
    )
    assert member is not None
    return member.id


def response_detail_text(response) -> str:
    detail = response.json()["detail"]
    if isinstance(detail, str):
        return detail
    return str(detail)


def test_finance_lock_is_one_day_after_event_end():
    event = Event(
        title="Past Event",
        description="Test",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2020, 1, 1, 18, tzinfo=UTC),
        budget="100.00",
        created_by_id=1,
    )

    lock_at = get_event_finance_lock_at(event)
    assert lock_at == event.starts_at + FINANCE_EDIT_GRACE_PERIOD
    assert is_event_finance_locked(event, now=lock_at) is True
    assert is_event_finance_locked(event, now=lock_at - timedelta(seconds=1)) is False


def test_create_finance_entry_allowed_during_grace_period(
    client,
    treasurer_headers,
    db_session,
):
    event = Event(
        title="Recent Event",
        description="Test",
        event_type=EventType.MEETING,
        starts_at=datetime.now(UTC) - timedelta(hours=2),
        budget="100.00",
        created_by_id=get_treasurer_member_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    response = client.post(
        "/api/v1/finance",
        json={
            "entry_type": "expense",
            "category": "venue",
            "amount": "25.00",
            "description": "Late receipt",
            "event_id": event.id,
        },
        headers=treasurer_headers,
    )

    assert response.status_code == 201
    assert response.json()["event_id"] == event.id


def test_create_finance_entry_blocked_after_lock(
    client,
    treasurer_headers,
    db_session,
):
    event = Event(
        title="Old Event",
        description="Test",
        event_type=EventType.SOCIAL,
        starts_at=datetime(2020, 1, 1, 18, tzinfo=UTC),
        budget="100.00",
        created_by_id=get_treasurer_member_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    response = client.post(
        "/api/v1/finance",
        json={
            "entry_type": "expense",
            "category": "food_beverage",
            "amount": "10.00",
            "description": "Too late",
            "event_id": event.id,
        },
        headers=treasurer_headers,
    )

    assert response.status_code == 422
    assert "closed" in response_detail_text(response).lower()


def test_list_past_events_excludes_upcoming(client, board_headers, db_session):
    creator_id = get_board_member_id(db_session)
    past = Event(
        title="Past Event",
        description="Done",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2020, 1, 1, 18, tzinfo=UTC),
        budget="100.00",
        created_by_id=creator_id,
    )
    future = Event(
        title="Future Event",
        description="Soon",
        event_type=EventType.MEETING,
        starts_at=datetime(2035, 1, 1, 18, tzinfo=UTC),
        budget="100.00",
        created_by_id=creator_id,
    )
    db_session.add_all([past, future])
    db_session.commit()

    response = client.get("/api/v1/events/past", headers=board_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["events"][0]["name"] == "Past Event"
    assert body["events"][0]["is_past"] is True
    assert body["events"][0]["is_finance_locked"] is True


def test_event_response_includes_finance_closeout_fields(
    client,
    board_headers,
    db_session,
):
    event = Event(
        title="Grace Event",
        description="Recently finished",
        event_type=EventType.FUNDRAISER,
        starts_at=datetime.now(UTC) - timedelta(hours=1),
        budget="150.00",
        created_by_id=get_board_member_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    response = client.get(f"/api/v1/events/{event.id}", headers=board_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["is_past"] is True
    assert body["is_finance_grace_period"] is True
    assert body["is_finance_locked"] is False
    assert "finance_lock_at" in body
