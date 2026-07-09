from conftest import (
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


def test_approve_queues_welcome_email(block_external_integrations, client, db_session):
    register_member(client, email="newmember@semo.edu", student_id="11111111")
    create_board_member(db_session)

    response = client.patch(
        "/api/v1/members/1/approve",
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    block_external_integrations["celery_delay"].assert_called_once_with(
        email="newmember@semo.edu",
        full_name="Sapan Khadka",
    )


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


def test_board_member_lists_all_members_with_pagination(client, db_session):
    register_member(client, email="member1@semo.edu", student_id="11111111")
    register_member(client, email="member2@semo.edu", student_id="22222222")
    register_member(client, email="member3@semo.edu", student_id="33333333")
    create_board_member(db_session)

    response = client.get(
        "/api/v1/members",
        params={"page": 1, "page_size": 2},
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 2
    assert len(data["members"]) == 2
    assert all("password" not in member for member in data["members"])
    assert all("hashed_password" not in member for member in data["members"])


def test_board_member_lists_members_page_two(client, db_session):
    register_member(client, email="member1@semo.edu", student_id="11111111")
    register_member(client, email="member2@semo.edu", student_id="22222222")
    register_member(client, email="member3@semo.edu", student_id="33333333")
    create_board_member(db_session)

    response = client.get(
        "/api/v1/members",
        params={"page": 2, "page_size": 2},
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    assert data["page"] == 2
    assert len(data["members"]) == 2


def test_board_member_can_filter_members_by_status(client, db_session):
    register_member(client, email="pending1@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="pending1@semo.edu")
    register_member(client, email="pending2@semo.edu", student_id="22222222")
    create_board_member(db_session)

    response = client.get(
        "/api/v1/members",
        params={"status": "pending"},
        headers=auth_header(client, email="board@semo.edu"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["members"][0]["email"] == "pending2@semo.edu"
    assert data["members"][0]["status"] == "pending"


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
