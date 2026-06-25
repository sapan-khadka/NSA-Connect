import pytest

from conftest import auth_header, create_board_member, register_member, set_member_approved

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


def test_board_member_can_list_assignable_members(client, board_member_headers):
    response = client.get("/api/v1/members/assignees", headers=board_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["members"][0]["email"] == "board@semo.edu"
    assert body["members"][0]["role"] == "board"


def test_general_member_cannot_list_assignable_members(
    client,
    general_member_headers,
):
    response = client.get("/api/v1/members/assignees", headers=general_member_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_assignable_members_excludes_general_members(
    client,
    db_session,
    board_member_headers,
):
    register_member(client, email="general@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="general@semo.edu")

    response = client.get("/api/v1/members/assignees", headers=board_member_headers)

    assert response.status_code == 200
    emails = [member["email"] for member in response.json()["members"]]
    assert "general@semo.edu" not in emails
    assert "board@semo.edu" in emails
