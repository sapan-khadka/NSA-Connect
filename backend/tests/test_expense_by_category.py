from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member


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
def seeded_expense_categories(db_session, treasurer_member_headers):
    treasurer = db_session.scalar(
        select(Member).where(Member.email == "treasurer@semo.edu"),
    )
    assert treasurer is not None

    event = Event(
        title="Spring Social",
        description="Board social.",
        event_type=EventType.SOCIAL,
        starts_at=datetime(2030, 3, 10, 18, 0, tzinfo=UTC),
        budget=Decimal("200.00"),
        created_by_id=treasurer.id,
    )
    db_session.add(event)
    db_session.flush()

    db_session.add_all(
        [
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.FOOD_BEVERAGE,
                amount=Decimal("40.00"),
                description="Snacks",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 3, 15, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.FOOD_BEVERAGE,
                amount=Decimal("25.00"),
                description="Drinks",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 3, 20, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.VENUE,
                amount=Decimal("100.00"),
                description="Room rental",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 3, 18, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.INCOME,
                category=FinanceCategory.FUNDRAISING,
                amount=Decimal("150.00"),
                description="Ticket sales",
                event_id=event.id,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 3, 22, 12, 0, tzinfo=UTC),
            ),
            FinanceEntry(
                entry_type=FinanceEntryType.EXPENSE,
                category=FinanceCategory.MARKETING,
                amount=Decimal("30.00"),
                description="Fall flyers",
                event_id=None,
                created_by_id=treasurer.id,
                created_at=datetime(2030, 9, 1, 12, 0, tzinfo=UTC),
            ),
        ],
    )
    db_session.commit()


def test_board_can_view_expense_by_category(
    client,
    board_member_headers,
    seeded_expense_categories,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_expense"] == "195.00"
    assert len(body["categories"]) == 3
    assert body["categories"][0]["category"] == "venue"
    assert body["categories"][0]["total_expense"] == "100.00"
    assert body["categories"][1]["category"] == "food_beverage"
    assert body["categories"][1]["total_expense"] == "65.00"
    assert body["categories"][1]["entry_count"] == 2


def test_expense_by_category_filters_by_entry_semester(
    client,
    board_member_headers,
    seeded_expense_categories,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        params={"semester": "2030-spring"},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_expense"] == "165.00"
    assert len(body["categories"]) == 2
    category_names = {item["category"] for item in body["categories"]}
    assert category_names == {"food_beverage", "venue"}


def test_expense_by_category_excludes_income_entries(
    client,
    board_member_headers,
    seeded_expense_categories,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=board_member_headers,
    )

    categories = {item["category"] for item in response.json()["categories"]}
    assert "fundraising" not in categories


def test_general_member_cannot_view_expense_by_category(
    client,
    general_member_headers,
    seeded_expense_categories,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=general_member_headers,
    )

    assert response.status_code == 403


def test_treasurer_can_view_expense_by_category(
    client,
    treasurer_member_headers,
    seeded_expense_categories,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["total_expense"] == "195.00"
