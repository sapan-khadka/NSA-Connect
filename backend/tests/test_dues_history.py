from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_president_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.member import Member
from app.models.member_dues import MemberDues


@pytest.fixture
def treasurer_headers(client, db_session):
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def president_headers(client, db_session):
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def general_member(client, db_session):
    register_member(client, email="general@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="general@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "general@semo.edu"))


@pytest.fixture
def general_headers(client, general_member):
    return auth_header(client, email="general@semo.edu")


def test_self_dues_history_returns_all_semesters(
    client,
    db_session,
    general_member,
    general_headers,
):
    db_session.add_all(
        [
            MemberDues(
                member_id=general_member.id,
                semester="2025-fall",
                amount_owed=Decimal("20.00"),
                amount_paid=Decimal("20.00"),
                paid_at=datetime(2025, 9, 1, tzinfo=UTC),
            ),
            MemberDues(
                member_id=general_member.id,
                semester="2026-spring",
                amount_owed=Decimal("25.00"),
                amount_paid=Decimal("10.00"),
                paid_at=datetime(2026, 2, 1, tzinfo=UTC),
            ),
        ],
    )
    db_session.commit()

    response = client.get(
        "/api/v1/finance/dues/mine/history",
        headers=general_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["member_id"] == general_member.id
    assert body["total"] == 2
    assert [row["semester"] for row in body["records"]] == [
        "2025-fall",
        "2026-spring",
    ]
    assert body["records"][0]["amount_paid"] == "20.00"
    assert body["records"][1]["status"] == "partial"


def test_treasury_can_fetch_member_history_general_cannot(
    client,
    db_session,
    treasurer_headers,
    general_member,
    general_headers,
):
    db_session.add(
        MemberDues(
            member_id=general_member.id,
            semester="2026-fall",
            amount_owed=Decimal("20.00"),
            amount_paid=Decimal("20.00"),
            paid_at=datetime(2026, 8, 1, tzinfo=UTC),
        ),
    )
    db_session.commit()

    privileged = client.get(
        f"/api/v1/finance/dues/history?member_id={general_member.id}",
        headers=treasurer_headers,
    )
    assert privileged.status_code == 200
    assert privileged.json()["total"] == 1
    assert privileged.json()["records"][0]["amount_paid"] == "20.00"

    denied = client.get(
        f"/api/v1/finance/dues/history?member_id={general_member.id}",
        headers=general_headers,
    )
    assert denied.status_code == 403


def test_president_can_fetch_member_history(
    client,
    db_session,
    president_headers,
    general_member,
):
    response = client.get(
        f"/api/v1/finance/dues/history?member_id={general_member.id}",
        headers=president_headers,
    )
    assert response.status_code == 200
    assert response.json()["records"] == []


def test_history_404_for_unknown_member(client, treasurer_headers):
    response = client.get(
        "/api/v1/finance/dues/history?member_id=999999",
        headers=treasurer_headers,
    )
    assert response.status_code == 404
