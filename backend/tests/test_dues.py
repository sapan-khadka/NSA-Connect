from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_president_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)

from app.models.finance_entry import FinanceEntry, FinanceEntryType
from app.models.member import Member, MemberStatus
from app.models.member_dues import MemberDues

SEMESTER = "2026-fall"


@pytest.fixture
def treasurer_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def president_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _set_default_dues(client, headers, amount="20.00"):
    return client.put(
        "/api/v1/finance/dues/settings",
        headers=headers,
        json={"semester": SEMESTER, "default_amount": amount},
    )


def test_treasurer_can_set_default_and_generate_dues(
    client, db_session, treasurer_headers
):
    second = Member(
        full_name="Second Member",
        email="second@semo.edu",
        student_id="33333333",
        major="Biology",
        graduation_year=2027,
        hashed_password="hashed",
        status=MemberStatus.APPROVED,
        talents=[],
    )
    db_session.add(second)
    db_session.commit()

    settings_response = _set_default_dues(client, treasurer_headers)
    assert settings_response.status_code == 200
    assert settings_response.json()["default_amount"] == "20.00"

    generate_response = client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    assert generate_response.status_code == 200
    body = generate_response.json()
    assert body["created_count"] == 2
    assert body["skipped_count"] == 0

    dashboard = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    )
    assert dashboard.status_code == 200
    payload = dashboard.json()
    assert payload["summary"]["total_expected"] == "40.00"
    assert payload["summary"]["unpaid_count"] == 2
    assert payload["summary"]["paid_count"] == 0
    assert len(payload["records"]) == 2


def test_mark_paid_creates_finance_entry_and_updates_summary(
    client, db_session, treasurer_headers
):
    second = Member(
        full_name="Second Member",
        email="second@semo.edu",
        student_id="33333333",
        major="Biology",
        graduation_year=2027,
        hashed_password="hashed",
        status=MemberStatus.APPROVED,
        talents=[],
    )
    db_session.add(second)
    db_session.commit()

    _set_default_dues(client, treasurer_headers)
    client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )

    dashboard = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()
    dues_id = dashboard["records"][0]["id"]

    mark_paid = client.post(
        f"/api/v1/finance/dues/{dues_id}/mark-paid",
        headers=treasurer_headers,
        json={"payment_method": "venmo"},
    )
    assert mark_paid.status_code == 200
    record = mark_paid.json()
    assert record["status"] == "paid"
    assert record["payment_method"] == "venmo"
    assert record["finance_entry_id"] is not None

    entry = db_session.get(FinanceEntry, record["finance_entry_id"])
    assert entry is not None
    assert entry.entry_type == FinanceEntryType.INCOME
    assert entry.category == "membership_dues"
    assert Decimal(str(entry.amount)) == Decimal("20.00")

    summary = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()["summary"]
    assert summary["paid_count"] == 1
    assert summary["total_collected"] == "20.00"
    assert summary["total_outstanding"] == "20.00"


def test_mark_unpaid_removes_finance_entry(client, db_session, treasurer_headers):
    _set_default_dues(client, treasurer_headers)
    client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    dues_id = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()["records"][0]["id"]

    client.post(
        f"/api/v1/finance/dues/{dues_id}/mark-paid",
        headers=treasurer_headers,
        json={"payment_method": "cash"},
    )
    mark_unpaid = client.post(
        f"/api/v1/finance/dues/{dues_id}/mark-unpaid",
        headers=treasurer_headers,
    )
    assert mark_unpaid.status_code == 200
    assert mark_unpaid.json()["status"] == "unpaid"
    assert mark_unpaid.json()["finance_entry_id"] is None
    assert db_session.query(FinanceEntry).count() == 0


def test_status_filter_and_amount_override(client, db_session, treasurer_headers):
    _set_default_dues(client, treasurer_headers)
    client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    dues_id = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()["records"][0]["id"]

    override = client.patch(
        f"/api/v1/finance/dues/{dues_id}",
        headers=treasurer_headers,
        json={"amount_owed": "0.00"},
    )
    assert override.status_code == 200
    assert override.json()["status"] == "exempt"

    unpaid_only = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}&status=unpaid",
        headers=treasurer_headers,
    )
    assert unpaid_only.status_code == 200
    assert len(unpaid_only.json()["records"]) == 0


def test_member_can_view_own_dues_not_dashboard(
    client, member_headers, treasurer_headers
):
    _set_default_dues(client, treasurer_headers)
    client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )

    own = client.get(
        f"/api/v1/finance/dues/mine?semester={SEMESTER}",
        headers=member_headers,
    )
    assert own.status_code == 200
    assert own.json()["has_record"] is True
    assert own.json()["status"] == "unpaid"

    denied = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=member_headers,
    )
    assert denied.status_code == 403


def test_president_can_manage_dues(client, president_headers):
    response = _set_default_dues(client, president_headers)
    assert response.status_code == 200


def test_generate_requires_default_amount(client, treasurer_headers):
    response = client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    assert response.status_code == 400


def test_mark_paid_increases_treasury_income_exactly_once(
    client,
    db_session,
    treasurer_headers,
):
    """Marking dues paid should create exactly one ledger row — not inflate treasury."""
    _set_default_dues(client, treasurer_headers)
    client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    dues_id = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()["records"][0]["id"]

    before = client.get("/api/v1/finance/summary", headers=treasurer_headers)
    assert before.status_code == 200
    assert before.json()["total_income"] == "0.00"
    assert before.json()["entry_count"] == 0

    mark_paid = client.post(
        f"/api/v1/finance/dues/{dues_id}/mark-paid",
        headers=treasurer_headers,
        json={"payment_method": "venmo"},
    )
    assert mark_paid.status_code == 200
    finance_entry_id = mark_paid.json()["finance_entry_id"]

    after = client.get("/api/v1/finance/summary", headers=treasurer_headers)
    assert after.status_code == 200
    assert after.json()["total_income"] == "20.00"
    assert after.json()["entry_count"] == 1

    assert db_session.query(FinanceEntry).count() == 1

    # Re-marking paid (e.g. changing method) must update the same entry,
    # not add another.
    remark = client.post(
        f"/api/v1/finance/dues/{dues_id}/mark-paid",
        headers=treasurer_headers,
        json={"payment_method": "cash"},
    )
    assert remark.status_code == 200
    assert remark.json()["finance_entry_id"] == finance_entry_id
    assert db_session.query(FinanceEntry).count() == 1

    still = client.get("/api/v1/finance/summary", headers=treasurer_headers).json()
    assert still["total_income"] == "20.00"
    assert still["entry_count"] == 1


def test_generate_bulk_is_idempotent_for_all_approved_members(
    client,
    db_session,
    treasurer_headers,
):
    """Bulk-generate should create one record per approved member and skip on re-run."""
    for index in range(41):
        db_session.add(
            Member(
                full_name=f"Member {index:02d}",
                email=f"member{index:02d}@semo.edu",
                student_id=f"{index:08d}",
                major="Biology",
                graduation_year=2027,
                hashed_password="hashed",
                status=MemberStatus.APPROVED,
                talents=[],
            ),
        )
    db_session.commit()

    _set_default_dues(client, treasurer_headers, amount="25.00")

    first = client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["created_count"] == 42  # treasurer + 41 seeded members
    assert first_body["skipped_count"] == 0

    dashboard = client.get(
        f"/api/v1/finance/dues?semester={SEMESTER}",
        headers=treasurer_headers,
    ).json()
    assert dashboard["summary"]["member_count"] == 42
    assert dashboard["summary"]["total_expected"] == "1050.00"  # 42 × $25
    assert dashboard["summary"]["unpaid_count"] == 42
    assert len(dashboard["records"]) == 42

    second = client.post(
        "/api/v1/finance/dues/generate",
        headers=treasurer_headers,
        json={"semester": SEMESTER},
    )
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["created_count"] == 0
    assert second_body["skipped_count"] == 42

    assert (
        db_session.query(MemberDues).filter(MemberDues.semester == SEMESTER).count()
        == 42
    )
