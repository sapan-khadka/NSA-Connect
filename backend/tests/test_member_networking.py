import pytest

from conftest import auth_header, create_board_member, register_member, set_member_approved


def _register_and_approve(client, db_session, *, email="member@semo.edu", student_id="12345678"):
    register_member(client, email=email, student_id=student_id)
    set_member_approved(db_session, email=email)
    return auth_header(client, email=email)


def _register_board(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_member_can_update_profile_with_talents_and_privacy(client, db_session):
    headers = _register_and_approve(client, db_session)

    response = client.patch(
        "/api/v1/members/me",
        headers=headers,
        json={
            "interests": "hiking, coding",
            "bio": "NSA member",
            "talents": ["dancing", "singing"],
            "phone": "555-0100",
            "social_handle": "@member",
            "phone_visibility": "board_only",
            "social_handle_visibility": "public",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["interests"] == "hiking, coding"
    assert body["talents"] == ["dancing", "singing"]
    assert body["phone"] == "555-0100"
    assert body["social_handle"] == "@member"


def test_general_member_cannot_see_board_only_contact_fields(client, db_session):
    member_headers = _register_and_approve(client, db_session, email="a@semo.edu", student_id="11111111")

    me = client.get("/api/v1/members/me", headers=member_headers).json()
    client.patch(
        "/api/v1/members/me",
        headers=member_headers,
        json={
            "phone": "555-9999",
            "phone_visibility": "board_only",
            "email_visibility": "board_only",
        },
    )

    register_member(client, email="viewer@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="viewer@semo.edu")
    viewer_headers = auth_header(client, email="viewer@semo.edu")

    hidden_member = client.get(f"/api/v1/members/{me['id']}", headers=viewer_headers)
    assert hidden_member.status_code == 200
    hidden_body = hidden_member.json()
    assert hidden_body["phone"] is None
    assert hidden_body["email"] is None


def test_board_member_sees_all_contact_fields(client, db_session):
    member_headers = _register_and_approve(client, db_session, email="talent@semo.edu", student_id="33333333")
    client.patch(
        "/api/v1/members/me",
        headers=member_headers,
        json={"phone": "555-1212", "phone_visibility": "board_only"},
    )

    board_headers = _register_board(client, db_session)
    members = client.get("/api/v1/members", headers=board_headers)
    assert members.status_code == 200
    member = next(item for item in members.json()["members"] if item["phone"] == "555-1212")
    assert member["email"] is not None
    assert member["student_id"] is not None


def test_talent_filter_uses_any_match(client, db_session):
    headers = _register_and_approve(client, db_session, email="dancer@semo.edu", student_id="44444444")
    client.patch(
        "/api/v1/members/me",
        headers=headers,
        json={"talents": ["dancing"]},
    )

    register_member(client, email="singer@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="singer@semo.edu")
    singer_headers = auth_header(client, email="singer@semo.edu")
    client.patch(
        "/api/v1/members/me",
        headers=singer_headers,
        json={"talents": ["singing"]},
    )

    filtered = client.get(
        "/api/v1/members",
        headers=headers,
        params=[("talents", "dancing"), ("talents", "cooking")],
    )
    assert filtered.status_code == 200
    names = {item["full_name"] for item in filtered.json()["members"]}
    assert len(names) >= 1


def test_board_can_edit_other_member_profile(client, db_session):
    member_headers = _register_and_approve(client, db_session, email="editme@semo.edu", student_id="66666666")
    me = client.get("/api/v1/members/me", headers=member_headers).json()

    board_headers = _register_board(client, db_session)
    response = client.patch(
        f"/api/v1/members/{me['id']}",
        headers=board_headers,
        json={"bio": "Updated by board"},
    )
    assert response.status_code == 200
    assert response.json()["bio"] == "Updated by board"


def test_invite_members_to_event(client, db_session):
    member_headers = _register_and_approve(client, db_session, email="invite@semo.edu", student_id="77777777")
    me = client.get("/api/v1/members/me", headers=member_headers).json()
    client.patch(
        "/api/v1/members/me",
        headers=member_headers,
        json={"talents": ["dancing"]},
    )

    board_headers = _register_board(client, db_session)
    event = client.post(
        "/api/v1/events",
        headers=board_headers,
        json={
            "name": "Cultural Night",
            "starts_at": "2031-06-01T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Showcase",
            "budget": "100.00",
        },
    ).json()

    invite = client.post(
        f"/api/v1/events/{event['id']}/invited-participants",
        headers=board_headers,
        json={"member_ids": [me["id"]]},
    )
    assert invite.status_code == 201
    assert invite.json()["total"] == 1

    detail = client.get(f"/api/v1/events/{event['id']}", headers=member_headers)
    assert detail.status_code == 200
    assert detail.json()["current_member_is_invited_participant"] is True

    listed = client.get(
        f"/api/v1/events/{event['id']}/invited-participants",
        headers=board_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
