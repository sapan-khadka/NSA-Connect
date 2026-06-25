from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member
from conftest import (
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def treasurer_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def seeded_event_budget_data(db_session, treasurer_member_headers):
    treasurer = db_session.scalar(
        select(Member).where(Member.email == "treasurer@semo.edu"),
    )
    assert treasurer is not None

    tracked_event = Event(
        title="Dashain Celebration",
        description="Annual cultural night.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 5, 15, 18, 0, tzinfo=UTC),
        budget=Decimal("250.00"),
        created_by_id=treasurer.id,
    )
    empty_event = Event(
        title="Spring Picnic",
        description="No spending yet.",
        event_type=EventType.SOCIAL,
        starts_at=datetime(2030, 3, 10, 12, 0, tzinfo=UTC),
        budget=Decimal("100.00"),
        created_by_id=treasurer.id,
    )
    fall_event = Event(
        title="Fall Mixer",
        description="Later semester event.",
        event_type=EventType.SOCIAL,
        starts_at=datetime(2030, 10, 1, 18, 0, tzinfo=UTC),
        budget=Decimal("75.00"),
        created_by_id=treasurer.id,
    )
    db_session.add_all([tracked_event, empty_event, fall_event])
    db_session.flush()

    db_session.add_all(
        [
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.FOOD_BEVERAGE,
                amount=Decimal("40.00"),
                description="Snacks",
                event_id=tracked_event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 5, 1, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.VENUE,
                amount=Decimal("230.00"),
                description="Venue deposit",
                event_id=tracked_event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 5, 15, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.INCOME,
                category=FinanceCategory.FUNDRAISING,
                amount=Decimal("120.00"),
                description="Ticket sales",
                event_id=tracked_event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 5, 20, 12, 0, tzinfo=UTC),
            ),
        ],
    )
    db_session.commit()

    return {
        "tracked_event_id": tracked_event.id,
        "empty_event_id": empty_event.id,
        "fall_event_id": fall_event.id,
    }


def test_board_can_view_event_budget_breakdown(
    client,
    board_member_headers,
    seeded_event_budget_data,
):
    response = client.get(
        "/api/v1/finance/event-budgets",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3

    tracked = next(
        event
        for event in body["events"]
        if event["event_id"] == seeded_event_budget_data["tracked_event_id"]
    )
    assert tracked["event_name"] == "Dashain Celebration"
    assert tracked["planned_budget"] == "250.00"
    assert tracked["actual_expense"] == "270.00"
    assert tracked["actual_income"] == "120.00"
    assert tracked["budget_remaining"] == "-20.00"
    assert tracked["over_budget"] is True
    assert tracked["entry_count"] == 3

    empty = next(
        event
        for event in body["events"]
        if event["event_id"] == seeded_event_budget_data["empty_event_id"]
    )
    assert empty["planned_budget"] == "100.00"
    assert empty["actual_expense"] == "0.00"
    assert empty["budget_remaining"] == "100.00"
    assert empty["over_budget"] is False
    assert empty["entry_count"] == 0


def test_event_budget_breakdown_filters_events_by_start_semester(
    client,
    board_member_headers,
    seeded_event_budget_data,
):
    response = client.get(
        "/api/v1/finance/event-budgets",
        params={"semester": "2030-spring"},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    event_ids = {event["event_id"] for event in body["events"]}
    assert seeded_event_budget_data["tracked_event_id"] in event_ids
    assert seeded_event_budget_data["empty_event_id"] in event_ids
    assert seeded_event_budget_data["fall_event_id"] not in event_ids


def test_general_member_cannot_view_event_budget_breakdown(
    client,
    general_member_headers,
    seeded_event_budget_data,
):
    response = client.get(
        "/api/v1/finance/event-budgets",
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Requires board role or higher"


def test_treasurer_can_view_event_budget_breakdown(
    client,
    treasurer_member_headers,
    seeded_event_budget_data,
):
    response = client.get(
        "/api/v1/finance/event-budgets",
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["total"] == 3
