"""Private officer notes on a member — board+ only."""

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.member import Member


@pytest.fixture
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def general_member(client, db_session):
    register_member(client, email="general@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="general@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "general@semo.edu"))


@pytest.fixture
def general_headers(client, general_member):
    return auth_header(client, email="general@semo.edu")


@pytest.fixture
def other_member(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="other@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "other@semo.edu"))


def test_board_can_crud_member_notes(client, board_headers, general_member):
    empty = client.get(
        f"/api/v1/members/{general_member.id}/notes",
        headers=board_headers,
    )
    assert empty.status_code == 200
    assert empty.json()["notes"] == []
    assert empty.json()["total"] == 0

    created = client.post(
        f"/api/v1/members/{general_member.id}/notes",
        headers=board_headers,
        json={"content": "Follow up on workshop RSVP.", "pinned": True},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["member_id"] == general_member.id
    assert body["content"] == "Follow up on workshop RSVP."
    assert body["pinned"] is True
    assert body["author_name"]

    listed = client.get(
        f"/api/v1/members/{general_member.id}/notes",
        headers=board_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["notes"][0]["id"] == body["id"]

    updated = client.patch(
        f"/api/v1/members/{general_member.id}/notes/{body['id']}",
        headers=board_headers,
        json={"content": "Updated note.", "pinned": False},
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "Updated note."
    assert updated.json()["pinned"] is False

    deleted = client.delete(
        f"/api/v1/members/{general_member.id}/notes/{body['id']}",
        headers=board_headers,
    )
    assert deleted.status_code == 204

    after = client.get(
        f"/api/v1/members/{general_member.id}/notes",
        headers=board_headers,
    )
    assert after.json()["notes"] == []


def test_general_member_cannot_access_notes(
    client,
    general_headers,
    general_member,
    other_member,
):
    for member_id in (general_member.id, other_member.id):
        listed = client.get(
            f"/api/v1/members/{member_id}/notes",
            headers=general_headers,
        )
        assert listed.status_code == 403

        created = client.post(
            f"/api/v1/members/{member_id}/notes",
            headers=general_headers,
            json={"content": "Should not work"},
        )
        assert created.status_code == 403


def test_notes_404_for_unknown_member(client, board_headers):
    response = client.get(
        "/api/v1/members/999999/notes",
        headers=board_headers,
    )
    assert response.status_code == 404
