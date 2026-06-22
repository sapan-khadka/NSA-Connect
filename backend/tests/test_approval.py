from conftest import (
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    login_member,
    register_member,
    set_member_approved,
)


def test_pending_member_cannot_login(client):
    register_member(client)

    response = login_member(client)

    assert response.status_code == 403
    assert response.json()["detail"] == "Member account is not approved"


def test_board_member_approves_pending_signup(client, db_session):
    register_member(client, email="newmember@semo.edu", student_id="11111111")
    create_board_member(db_session)

    pending_login = login_member(client, email="newmember@semo.edu")
    assert pending_login.status_code == 403

    board_headers = auth_header(client, email="board@semo.edu")
    approve = client.patch(
        "/api/v1/members/1/approve",
        headers=board_headers,
    )

    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    approved_login = login_member(client, email="newmember@semo.edu")
    assert approved_login.status_code == 200
    assert "access_token" in approved_login.json()


def test_board_member_lists_pending_signups(client, db_session):
    register_member(client, email="pending1@semo.edu", student_id="11111111")
    register_member(client, email="pending2@semo.edu", student_id="22222222")
    create_board_member(db_session)

    response = client.get(
        "/api/v1/members/pending",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert all(member["status"] == "pending" for member in data["members"])


def test_general_member_cannot_approve(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    register_member(client, email="pending@semo.edu", student_id="22222222")

    response = client.patch(
        "/api/v1/members/2/approve",
        headers=auth_header(client),
    )

    assert response.status_code == 403


def test_board_member_rejects_pending_signup(client, db_session):
    register_member(client, email="rejectme@semo.edu", student_id="33333333")
    create_board_member(db_session)

    response = client.patch(
        "/api/v1/members/1/reject",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"

    login_response = login_member(client, email="rejectme@semo.edu")
    assert login_response.status_code == 403


def test_cannot_approve_already_approved_member(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    create_board_member(db_session)

    response = client.patch(
        "/api/v1/members/1/approve",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only pending members can be approved"
