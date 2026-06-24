from conftest import auth_header, register_member, set_member_approved


def test_member_updates_own_profile(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    response = client.patch(
        "/api/v1/members/me",
        headers=auth_header(client),
        json={
            "full_name": "Updated Name",
            "email": "updated@semo.edu",
            "major": "Biology",
            "graduation_year": 2029,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["email"] == "updated@semo.edu"
    assert data["major"] == "Biology"
    assert data["graduation_year"] == 2029


def test_member_cannot_take_another_members_email(client, db_session):
    register_member(client, email="member1@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="member1@semo.edu")
    register_member(client, email="member2@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="member2@semo.edu")

    response = client.patch(
        "/api/v1/members/me",
        headers=auth_header(client, email="member2@semo.edu"),
        json={"email": "member1@semo.edu"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_update_profile_requires_at_least_one_field(client, db_session):
    register_member(client)
    set_member_approved(db_session)

    response = client.patch(
        "/api/v1/members/me",
        headers=auth_header(client),
        json={},
    )

    assert response.status_code == 422


def test_unauthenticated_member_cannot_update_profile(client):
    response = client.patch(
        "/api/v1/members/me",
        json={"full_name": "Hacker"},
    )

    assert response.status_code == 401
