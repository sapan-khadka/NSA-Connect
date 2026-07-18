import csv
from io import StringIO

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

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


def test_board_can_export_members_csv(client, board_member_headers):
    response = client.get("/api/v1/members/export", headers=board_member_headers)

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert "nsa-members-" in response.headers["content-disposition"]

    rows = list(csv.reader(StringIO(response.text)))
    assert rows[0] == [
        "full_name",
        "email",
        "student_id",
        "major",
        "graduation_year",
        "role",
        "status",
        "position",
        "dues_status",
        "outstanding_dues",
    ]
    emails = {row[1] for row in rows[1:]}
    assert "board@semo.edu" in emails


def test_general_member_cannot_export_members_csv(
    client,
    general_member_headers,
):
    response = client.get("/api/v1/members/export", headers=general_member_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL
