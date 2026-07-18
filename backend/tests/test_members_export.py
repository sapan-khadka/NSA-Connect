import csv
from decimal import Decimal
from io import StringIO

import pytest
from sqlalchemy import select
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.lib.semester import get_current_semester_slug
from app.models.member import Member
from app.models.member_dues import MemberDues

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


def test_board_can_export_members_csv(client, db_session, board_member_headers):
    board_member = db_session.scalar(
        select(Member).where(Member.email == "board@semo.edu"),
    )
    db_session.add(
        MemberDues(
            member_id=board_member.id,
            semester=get_current_semester_slug(),
            amount_owed=Decimal("75.00"),
            amount_paid=Decimal("20.00"),
        ),
    )
    db_session.commit()

    response = client.get("/api/v1/members/export", headers=board_member_headers)

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert "nsa-members-" in response.headers["content-disposition"]

    rows = list(csv.reader(StringIO(response.text)))
    assert rows[0] == [
        "name",
        "email",
        "role",
        "status",
        "graduation_year",
        "outstanding_dues",
    ]
    rows_by_email = {row[1]: row for row in rows[1:]}
    assert rows_by_email["board@semo.edu"] == [
        "Board Member",
        "board@semo.edu",
        "board",
        "approved",
        str(board_member.graduation_year),
        "55.00",
    ]


def test_general_member_cannot_export_members_csv(
    client,
    general_member_headers,
):
    response = client.get("/api/v1/members/export", headers=general_member_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL
