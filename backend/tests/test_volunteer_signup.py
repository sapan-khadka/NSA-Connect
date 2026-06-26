import pytest

from conftest import auth_header, create_board_member, register_member, set_member_approved


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night with food and performances.",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


def _slot_payload(**overrides):
    payload = {
        "task_name": "Setup crew",
        "max_signup_count": 2,
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def second_member_headers(client, db_session):
    register_member(client, email="second@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="second@semo.edu")
    return auth_header(client, email="second@semo.edu")


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def _create_slot(client, board_member_headers, **slot_overrides):
    event_response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    slot_response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json=_slot_payload(**slot_overrides),
        headers=board_member_headers,
    )
    assert slot_response.status_code == 201
    return slot_response.json()


def test_member_can_sign_up_for_volunteer_slot(client, board_member_headers, general_member_headers):
    slot = _create_slot(client, board_member_headers)

    response = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["slot_id"] == slot["id"]
    assert isinstance(body["member_id"], int)
    assert body["task_name"] == "Setup crew"
    assert body["max_signup_count"] == 2
    assert body["signup_count"] == 1
    assert body["spots_remaining"] == 1
    assert body["is_full"] is False
    assert "created_at" in body


def test_signup_returns_409_when_slot_is_full(
    client,
    board_member_headers,
    general_member_headers,
    second_member_headers,
):
    slot = _create_slot(client, board_member_headers, max_signup_count=1)

    first = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=second_member_headers,
    )

    assert second.status_code == 409
    assert second.json()["detail"] == "Volunteer slot is full"


def test_signup_returns_409_when_member_already_signed_up(
    client,
    board_member_headers,
    general_member_headers,
):
    slot = _create_slot(client, board_member_headers)

    first = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )
    assert first.status_code == 201

    duplicate = client.post(
        f"/api/v1/slots/{slot['id']}/signup",
        headers=general_member_headers,
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Already signed up for this volunteer slot"


def test_signup_returns_404_for_missing_slot(client, general_member_headers):
    response = client.post(
        "/api/v1/slots/999/signup",
        headers=general_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Volunteer slot not found"


def test_unauthenticated_signup_gets_401(client, board_member_headers):
    slot = _create_slot(client, board_member_headers)

    response = client.post(f"/api/v1/slots/{slot['id']}/signup")

    assert response.status_code == 401
