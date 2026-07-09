from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_treasurer_member,
    register_member,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member


@pytest.fixture
def treasurer_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def seeded_finance_entries(db_session, treasurer_member_headers):
    treasurer = db_session.scalar(
        select(Member).where(Member.email == "treasurer@semo.edu"),
    )
    assert treasurer is not None
    event = Event(
        title="Dashain Celebration",
        description="Annual cultural night.",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        budget=Decimal("250.00"),
        created_by_id=treasurer.id,
    )
    db_session.add(event)
    db_session.flush()

    db_session.add_all(
        [
            FinanceEntry(
                entry_type=FinanceEntryType.INCOME,
                category=FinanceCategory.FUNDRAISING,
                amount=Decimal("100.00"),
                description="Spring fundraiser",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 3, 15, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.FOOD_BEVERAGE,
                amount=Decimal("40.00"),
                description="Spring snacks",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 4, 1, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.INCOME,
                category=FinanceCategory.DONATION,
                amount=Decimal("200.00"),
                description="Fall donation",
                event_id=None,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 9, 1, 12, 0, tzinfo=UTC),
            ),
        ],
    )
    db_session.commit()

    return {"event_id": event.id}


def test_finance_summary_returns_running_total_and_breakdown(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get("/api/v1/finance/summary", headers=treasurer_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == "260.00"
    assert body["total_income"] == "300.00"
    assert body["total_expense"] == "40.00"
    assert body["entry_count"] == 3

    assert body["pre_event"]["income"] == "200.00"
    assert body["pre_event"]["expense"] == "0.00"
    assert body["pre_event"]["balance"] == "200.00"
    assert body["pre_event"]["entry_count"] == 1

    assert len(body["events"]) == 1
    event_summary = body["events"][0]
    assert event_summary["event_id"] == seeded_finance_entries["event_id"]
    assert event_summary["event_name"] == "Dashain Celebration"
    assert event_summary["income"] == "100.00"
    assert event_summary["expense"] == "40.00"
    assert event_summary["balance"] == "60.00"
    assert event_summary["entry_count"] == 2


def test_finance_summary_filters_by_semester(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get(
        "/api/v1/finance/summary",
        params={"semester": "2030-spring"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == "60.00"
    assert body["total_income"] == "100.00"
    assert body["total_expense"] == "40.00"
    assert body["entry_count"] == 2
    assert body["pre_event"]["entry_count"] == 0
    assert len(body["events"]) == 1
    assert body["events"][0]["balance"] == "60.00"


def test_finance_summary_empty_database(client, treasurer_member_headers):
    response = client.get("/api/v1/finance/summary", headers=treasurer_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == "0.00"
    assert body["total_income"] == "0.00"
    assert body["total_expense"] == "0.00"
    assert body["entry_count"] == 0
    assert body["pre_event"]["entry_count"] == 0
    assert body["events"] == []


def test_finance_summary_unauthenticated_gets_401(client, seeded_finance_entries):
    response = client.get("/api/v1/finance/summary")

    assert response.status_code == 401
