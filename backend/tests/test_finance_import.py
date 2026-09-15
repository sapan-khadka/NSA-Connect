from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceEntry, FinanceEntryType
from app.models.member import Member

FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "finance" / "nsa_funding_expense_sheet.csv"
)


@pytest.fixture
def treasurer_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def seeded_events(db_session, treasurer_member_headers):
    treasurer = db_session.scalar(
        select(Member).where(Member.email == "treasurer@semo.edu"),
    )
    assert treasurer is not None

    teej = Event(
        title="Teej",
        description="Teej celebration",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 9, 10, 18, 0, tzinfo=UTC),
        budget=Decimal("300.00"),
        created_by_id=treasurer.id,
    )
    vigil = Event(
        title="Candle Light Vigil",
        description="Campus vigil",
        event_type=EventType.SERVICE,
        starts_at=datetime(2030, 9, 9, 19, 0, tzinfo=UTC),
        budget=Decimal("50.00"),
        created_by_id=treasurer.id,
    )
    db_session.add_all([teej, vigil])
    db_session.commit()
    return {"teej_id": teej.id, "vigil_id": vigil.id}


def _import_csv(client, headers, *, dry_run: bool):
    return client.post(
        "/api/v1/finance/import",
        params={"dry_run": str(dry_run).lower()},
        headers=headers,
        files={
            "file": (
                "nsa_funding_expense_sheet.csv",
                FIXTURE_PATH.read_bytes(),
                "text/csv",
            ),
        },
    )


def test_dry_run_previews_expense_rows(
    client,
    treasurer_member_headers,
    seeded_events,
):
    response = _import_csv(client, treasurer_member_headers, dry_run=True)

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 0
    assert body["rows_ready"] == 4
    assert body["rows_skipped"] >= 2
    assert len(body["preview_rows"]) == 4

    preview = body["preview_rows"]
    assert all(row["entry_type"] == "expense" for row in preview)
    assert all(row["category"] == "food_beverage" for row in preview)
    assert {row["event_id"] for row in preview} == {
        seeded_events["teej_id"],
        seeded_events["vigil_id"],
    }
    assert any("Walmart" in row["description"] for row in preview)

    skip_reasons = {row["reason"] for row in body["skipped_rows"]}
    assert "Skipped total or summary row" in skip_reasons

    listed = client.get("/api/v1/finance", headers=treasurer_member_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 0


def test_confirm_import_writes_entries_with_sheet_dates(
    client,
    treasurer_member_headers,
    seeded_events,
    db_session,
):
    dry = _import_csv(client, treasurer_member_headers, dry_run=True)
    assert dry.status_code == 200
    assert dry.json()["rows_ready"] == 4

    response = _import_csv(client, treasurer_member_headers, dry_run=False)
    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 4
    assert body["rows_ready"] == 4

    entries = list(
        db_session.scalars(
            select(FinanceEntry).order_by(FinanceEntry.created_at, FinanceEntry.id)
        ).all()
    )
    assert len(entries) == 4
    assert all(entry.entry_type == FinanceEntryType.EXPENSE for entry in entries)
    assert sum(entry.amount for entry in entries) == Decimal("255.01")

    vigil_entries = [e for e in entries if e.event_id == seeded_events["vigil_id"]]
    teej_entries = [e for e in entries if e.event_id == seeded_events["teej_id"]]
    assert len(vigil_entries) == 1
    assert len(teej_entries) == 3
    assert vigil_entries[0].created_at.date() == datetime(2026, 9, 9, tzinfo=UTC).date()
    assert teej_entries[0].created_at.date() == datetime(2026, 9, 10, tzinfo=UTC).date()


def test_unknown_event_is_skipped(client, treasurer_member_headers):
    csv_bytes = (
        b"Date,Category,Quantity,Event,Vendor,Price\n"
        b"9/10/2026,Food,1,Unknown Festival,Store,$10.00\n"
    )
    response = client.post(
        "/api/v1/finance/import",
        params={"dry_run": "true"},
        headers=treasurer_member_headers,
        files={"file": ("rows.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["rows_ready"] == 0
    assert body["skipped_rows"][0]["reason"] == "No matching event"


def test_blank_event_imports_as_general(client, treasurer_member_headers):
    csv_bytes = (
        b"Date,Category,Quantity,Event,Vendor,Price\n"
        b"9/10/2026,Supplies,,,Office Depot,$12.50\n"
    )
    response = client.post(
        "/api/v1/finance/import",
        params={"dry_run": "false"},
        headers=treasurer_member_headers,
        files={"file": ("rows.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 1
    assert body["preview_rows"][0]["event_id"] is None
    assert body["preview_rows"][0]["category"] == "supplies"


def test_board_cannot_import_finance_csv(client, board_member_headers):
    response = _import_csv(client, board_member_headers, dry_run=True)
    assert response.status_code == 403


def test_rejects_non_csv(client, treasurer_member_headers):
    response = client.post(
        "/api/v1/finance/import",
        params={"dry_run": "true"},
        headers=treasurer_member_headers,
        files={"file": ("sheet.xlsx", b"not-csv", "application/octet-stream")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Upload must be a CSV file"
