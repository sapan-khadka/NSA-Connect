from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.event_checkin import EventCheckIn
from app.models.event_feedback import EventFeedback
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member
from app.models.member_dues import MemberDues


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


def _create_event(
    db, *, board_id: int, starts_at: datetime, title: str = "Cultural Night"
) -> Event:
    event = Event(
        title=title,
        description="Test event",
        event_type=EventType.CULTURAL,
        starts_at=starts_at,
        budget=Decimal("100.00"),
        created_by_id=board_id,
    )
    db.add(event)
    db.flush()
    return event


def test_board_can_generate_semester_report(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    general = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))

    event = _create_event(
        db_session,
        board_id=board.id,
        starts_at=datetime(2026, 3, 15, 18, 0, tzinfo=UTC),
    )
    db_session.add(
        EventCheckIn(
            event_id=event.id,
            member_id=general.id,
            checked_in_at=datetime(2026, 3, 15, 18, 30, tzinfo=UTC),
        ),
    )
    db_session.add(
        EventFeedback(
            event_id=event.id,
            member_id=general.id,
            rating=5,
            comment="Great event",
            created_at=datetime(2026, 3, 16, tzinfo=UTC),
        ),
    )
    db_session.add(
        FinanceEntry(
            entry_type=FinanceEntryType.INCOME,
            category=FinanceCategory.FUNDRAISING.value,
            amount=Decimal("150.00"),
            description="Ticket sales",
            created_by_id=board.id,
            created_at=datetime(2026, 3, 20, tzinfo=UTC),
        ),
    )
    db_session.add(
        MemberDues(
            member_id=general.id,
            semester="2026-spring",
            amount_owed=Decimal("25.00"),
            amount_paid=Decimal("25.00"),
            paid_at=datetime(2026, 2, 1, tzinfo=UTC),
        ),
    )
    db_session.commit()

    response = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=board_member_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["data"]["events"]["total_events"] == 1
    assert body["data"]["attendance"]["total_checkins"] == 1
    assert body["data"]["finance"]["total_income"] == "150.00"
    assert body["data"]["dues"]["paid_count"] == 1
    assert body["data"]["feedback"]["response_count"] == 1
    assert body["data"]["feedback"]["average_rating"] == 5.0
    assert "comment" not in body["data"]["feedback"]


def test_general_member_cannot_generate_report(
    client,
    general_member_headers,
):
    response = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=general_member_headers,
    )
    assert response.status_code == 403


def test_general_member_cannot_view_generated_report(
    client,
    board_member_headers,
    general_member_headers,
):
    create_response = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=board_member_headers,
    )
    report_id = create_response.json()["id"]

    list_response = client.get("/api/v1/reports", headers=general_member_headers)
    assert list_response.status_code == 403

    detail_response = client.get(
        f"/api/v1/reports/{report_id}",
        headers=general_member_headers,
    )
    assert detail_response.status_code == 403

    pdf_response = client.get(
        f"/api/v1/reports/{report_id}/pdf",
        headers=general_member_headers,
    )
    assert pdf_response.status_code == 403


def test_board_member_can_view_generated_report(
    client,
    board_member_headers,
):
    create_response = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=board_member_headers,
    )
    report_id = create_response.json()["id"]

    list_response = client.get("/api/v1/reports", headers=board_member_headers)
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1

    detail_response = client.get(
        f"/api/v1/reports/{report_id}",
        headers=board_member_headers,
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == report_id


def test_report_pdf_download(
    client,
    board_member_headers,
):
    create_response = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=board_member_headers,
    )
    report_id = create_response.json()["id"]

    pdf_response = client.get(
        f"/api/v1/reports/{report_id}/pdf",
        headers=board_member_headers,
    )
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert pdf_response.content.startswith(b"%PDF")


def test_custom_date_range_report(
    client,
    db_session,
    board_member_headers,
):
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    _create_event(
        db_session,
        board_id=board.id,
        starts_at=datetime(2026, 4, 10, 18, 0, tzinfo=UTC),
        title="Spring Social",
    )
    db_session.commit()

    response = client.post(
        "/api/v1/reports",
        json={
            "range_type": "custom",
            "period_start": "2026-04-01T00:00:00Z",
            "period_end": "2026-05-01T00:00:00Z",
        },
        headers=board_member_headers,
    )
    assert response.status_code == 201
    assert response.json()["data"]["events"]["total_events"] == 1
