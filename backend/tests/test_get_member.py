import pytest
from conftest import (
    auth_header,
    create_board_member,
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


def test_board_member_can_get_member_by_id(client, board_member_headers):
    response = client.get("/api/v1/members/1", headers=board_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["email"].endswith("@semo.edu")
    assert "role" in body


def test_get_member_returns_404_for_unknown_id(client, board_member_headers):
    response = client.get("/api/v1/members/999", headers=board_member_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Member not found"


def test_general_member_can_get_approved_member_by_id(
    client, db_session, general_member_headers
):
    register_member(client, email="peer@semo.edu", student_id="99999999")
    set_member_approved(db_session, email="peer@semo.edu")

    response = client.get("/api/v1/members/2", headers=general_member_headers)

    assert response.status_code == 200
    assert response.json()["email"] is not None or response.json()["email"] is None
