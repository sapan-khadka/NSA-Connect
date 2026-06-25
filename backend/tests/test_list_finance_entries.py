from datetime import UTC, datetime
from decimal import Decimal

import pytest

from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member
from conftest import (
    auth_header,
    create_treasurer_member,
    register_member,
)


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

    spring_income = FinanceEntry(
        entry_type=FinanceEntryType.INCOME,
        category=FinanceCategory.FUNDRAISING,
        amount=Decimal("100.00"),
        description="Spring fundraiser",
        event_id=event.id,
        created_by_id=treasurer.id,
        created_at=datetime(2030, 3, 15, 12, 0, tzinfo=UTC),
    )
    spring_expense = FinanceEntry(
        entry_type=FinanceEntryType.EXPENSE,
        category=FinanceCategory.FOOD_BEVERAGE,
        amount=Decimal("40.00"),
        description="Spring snacks",
        event_id=event.id,
        created_by_id=treasurer.id,
        created_at=datetime(2030, 4, 1, 12, 0, tzinfo=UTC),
    )
    fall_income = FinanceEntry(
        entry_type=FinanceEntryType.INCOME,
        category=FinanceCategory.DONATION,
        amount=Decimal("200.00"),
        description="Fall donation",
        event_id=None,
        created_by_id=treasurer.id,
        created_at=datetime(2030, 9, 1, 12, 0, tzinfo=UTC),
    )
    db_session.add_all([spring_income, spring_expense, fall_income])
    db_session.commit()

    return {
        "event_id": event.id,
        "spring_income_id": spring_income.id,
        "spring_expense_id": spring_expense.id,
        "fall_income_id": fall_income.id,
    }


def test_treasurer_can_list_finance_entries(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get("/api/v1/finance", headers=treasurer_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["entries"]) == 3


def test_list_finance_entries_filters_by_type_income(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get(
        "/api/v1/finance",
        params={"type": "income"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert all(entry["entry_type"] == "income" for entry in body["entries"])


def test_list_finance_entries_filters_by_type_expense(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get(
        "/api/v1/finance",
        params={"type": "expense"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["entries"][0]["entry_type"] == "expense"


def test_list_finance_entries_filters_by_semester(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    response = client.get(
        "/api/v1/finance",
        params={"semester": "2030-spring"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    descriptions = {entry["description"] for entry in body["entries"]}
    assert descriptions == {"Spring fundraiser", "Spring snacks"}


def test_list_finance_entries_filters_by_event_id(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    event_id = seeded_finance_entries["event_id"]
    response = client.get(
        "/api/v1/finance",
        params={"event_id": event_id},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert all(entry["event_id"] == event_id for entry in body["entries"])


def test_list_finance_entries_combines_filters(
    client,
    treasurer_member_headers,
    seeded_finance_entries,
):
    event_id = seeded_finance_entries["event_id"]
    response = client.get(
        "/api/v1/finance",
        params={
            "semester": "2030-spring",
            "type": "income",
            "event_id": event_id,
        },
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["entries"][0]["description"] == "Spring fundraiser"


def test_list_finance_entries_unauthenticated_gets_401(client, seeded_finance_entries):
    response = client.get("/api/v1/finance")

    assert response.status_code == 401


def test_list_finance_entries_rejects_invalid_semester(
    client,
    treasurer_member_headers,
):
    response = client.get(
        "/api/v1/finance",
        params={"semester": "2030-winter"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 422
