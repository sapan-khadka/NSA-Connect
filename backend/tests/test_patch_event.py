from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.lib.event_dates import EVENT_DATE_PAST_ERROR
from app.models.event import Event, EventType
from app.models.member import Member

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def past_event(db_session, board_member_headers):
    del board_member_headers
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assert board is not None
    event = Event(
        title="Dashain 2020",
        description="Past event for patch tests.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2020, 6, 1, 18, tzinfo=UTC),
        budget=Decimal("100.00"),
        show_in_photo_archive=True,
        created_by_id=board.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def test_board_member_can_patch_show_in_photo_archive(
    client,
    board_member_headers,
    past_event,
):
    response = client.patch(
        f"/api/v1/events/{past_event.id}",
        json={"show_in_photo_archive": False},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["show_in_photo_archive"] is False


def test_general_member_cannot_patch_event_settings(
    client,
    general_member_headers,
    past_event,
):
    response = client.patch(
        f"/api/v1/events/{past_event.id}",
        json={"show_in_photo_archive": False},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_patch_event_returns_404_for_missing_event(client, board_member_headers):
    response = client.patch(
        "/api/v1/events/99999",
        json={"show_in_photo_archive": True},
        headers=board_member_headers,
    )

    assert response.status_code == 404


def test_patch_event_rejects_past_start_date(
    client,
    board_member_headers,
    past_event,
):
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    past_start = datetime(
        yesterday.year,
        yesterday.month,
        yesterday.day,
        18,
        0,
        tzinfo=UTC,
    )

    response = client.patch(
        f"/api/v1/events/{past_event.id}",
        json={"starts_at": past_start.isoformat().replace("+00:00", "Z")},
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert EVENT_DATE_PAST_ERROR in response.text


def test_patch_event_allows_today_start_date(
    client,
    board_member_headers,
    past_event,
):
    today = datetime.now(UTC).date()
    today_start = datetime(
        today.year,
        today.month,
        today.day,
        9,
        0,
        tzinfo=UTC,
    )

    response = client.patch(
        f"/api/v1/events/{past_event.id}",
        json={"starts_at": today_start.isoformat().replace("+00:00", "Z")},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["starts_at"].startswith(today_start.isoformat()[:13])
