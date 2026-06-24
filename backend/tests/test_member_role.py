from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.member import Member, MemberRole


def test_president_promotes_general_member_to_board(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    create_president_member(db_session)

    response = client.patch(
        "/api/v1/members/1/role",
        headers=auth_header(client, email="president@semo.edu"),
        json={"role": "board"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "board"


def test_president_demotes_board_member_to_general(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    member = db_session.scalar(select(Member).where(Member.email == "member@semo.edu"))
    member.role = MemberRole.BOARD
    db_session.commit()
    create_president_member(db_session)

    response = client.patch(
        "/api/v1/members/1/role",
        headers=auth_header(client, email="president@semo.edu"),
        json={"role": "general"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "general"


def test_board_member_cannot_update_role(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    create_board_member(db_session)

    response = client.patch(
        "/api/v1/members/1/role",
        headers=auth_header(client, email="board@semo.edu"),
        json={"role": "board"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Requires president role or higher"


def test_general_member_cannot_update_role(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    register_member(client, email="other@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="other@semo.edu")
    create_president_member(db_session)

    response = client.patch(
        "/api/v1/members/2/role",
        headers=auth_header(client, email="member@semo.edu"),
        json={"role": "board"},
    )

    assert response.status_code == 403


def test_president_cannot_change_own_role(client, db_session):
    create_president_member(db_session)

    response = client.patch(
        "/api/v1/members/1/role",
        headers=auth_header(client, email="president@semo.edu"),
        json={"role": "general"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot change your own role"


def test_cannot_promote_pending_member(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    create_president_member(db_session)

    response = client.patch(
        "/api/v1/members/1/role",
        headers=auth_header(client, email="president@semo.edu"),
        json={"role": "board"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only approved members can have their role updated"


def test_cannot_assign_treasurer_or_president_role(client, db_session):
    register_member(client, email="member@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member@semo.edu")
    create_president_member(db_session)
    headers = auth_header(client, email="president@semo.edu")

    treasurer_response = client.patch(
        "/api/v1/members/1/role",
        headers=headers,
        json={"role": "treasurer"},
    )
    president_response = client.patch(
        "/api/v1/members/1/role",
        headers=headers,
        json={"role": "president"},
    )

    assert treasurer_response.status_code == 422
    assert president_response.status_code == 422
