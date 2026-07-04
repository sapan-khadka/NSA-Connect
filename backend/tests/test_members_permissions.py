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


def test_unauthenticated_request_gets_401_on_member_directory(client):
    response = client.get("/api/v1/members")

    assert response.status_code == 401


def test_general_member_can_access_member_directory(client, general_member_headers):
    response = client.get("/api/v1/members", headers=general_member_headers)

    assert response.status_code == 200
    assert "members" in response.json()
    assert all(member["status"] == "approved" for member in response.json()["members"])


def test_general_member_gets_403_on_pending_queue(client, general_member_headers):
    response = client.get("/api/v1/members/pending", headers=general_member_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


@pytest.mark.parametrize(
    "method,path",
    [
        ("patch", "/api/v1/members/2/approve"),
        ("patch", "/api/v1/members/2/reject"),
    ],
)
def test_general_member_gets_403_on_approval_actions(
    client,
    db_session,
    general_member_headers,
    method,
    path,
):
    register_member(client, email="pending@semo.edu", student_id="33333333")

    response = client.request(method, path, headers=general_member_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_board_member_can_access_member_directory(client, board_member_headers):
    response = client.get("/api/v1/members", headers=board_member_headers)

    assert response.status_code == 200
    assert "members" in response.json()


def test_general_member_can_access_own_profile(client, general_member_headers):
    response = client.get("/api/v1/members/me", headers=general_member_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "sapan@semo.edu"
    assert "password" not in response.json()
    assert "hashed_password" not in response.json()
