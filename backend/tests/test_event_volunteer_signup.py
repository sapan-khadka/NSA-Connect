import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)


def _event_payload(**overrides):
    payload = {
        "name": "Community Service Day",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "service",
        "description": "Help clean up the community garden.",
        "budget": "100.00",
    }
    payload.update(overrides)
    return payload


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


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_member_can_volunteer_with_note(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={"note": "I can help with setup and cleanup."},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event["id"]
    assert body["note"] == "I can help with setup and cleanup."
    assert body["status"] == "pending"
    assert body["created_at"]

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert detail.status_code == 200
    signup = detail.json()["current_member_volunteer_signup"]
    assert signup is not None
    assert signup["note"] == "I can help with setup and cleanup."
    assert signup["status"] == "pending"


def test_board_can_approve_volunteer(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    signup = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={"note": "Happy to help"},
    ).json()

    approved = client.patch(
        f"/api/v1/events/{event['id']}/volunteer-signups/{signup['id']}",
        headers=board_member_headers,
        json={"status": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    conflict = client.patch(
        f"/api/v1/events/{event['id']}/volunteer-signups/{signup['id']}",
        headers=board_member_headers,
        json={"status": "rejected"},
    )
    assert conflict.status_code == 409


def test_board_can_reject_volunteer(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    register_member(client, email="helper2@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="helper2@semo.edu")
    helper_headers = auth_header(client, email="helper2@semo.edu")

    signup = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=helper_headers,
        json={"note": "Available Saturday"},
    ).json()

    rejected = client.patch(
        f"/api/v1/events/{event['id']}/volunteer-signups/{signup['id']}",
        headers=board_member_headers,
        json={"status": "rejected"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    # Rejected volunteer can re-request.
    again = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=helper_headers,
        json={"note": "Still available"},
    )
    assert again.status_code == 201
    assert again.json()["status"] == "pending"


def test_member_can_volunteer_without_note(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={},
    )

    assert response.status_code == 201
    assert response.json()["note"] is None


def test_member_can_withdraw_volunteer_signup(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={"note": "Happy to help"},
    )

    response = client.delete(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
    )
    assert response.status_code == 204

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert detail.json()["current_member_volunteer_signup"] is None


def test_board_can_list_event_volunteers(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)
    client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={"note": "Decoration team"},
    )

    response = client.get(
        f"/api/v1/events/{event['id']}/volunteer-signups",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["signups"][0]["full_name"]
    assert body["signups"][0]["note"] == "Decoration team"
    assert body["signups"][0]["status"] == "pending"


def test_general_member_cannot_list_event_volunteers(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.get(
        f"/api/v1/events/{event['id']}/volunteer-signups",
        headers=general_member_headers,
    )

    assert response.status_code == 403


def test_volunteer_signup_closed_for_past_event(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    from datetime import UTC, datetime

    from app.models.event import Event

    event = _create_event(client, board_member_headers)
    db_event = db_session.get(Event, event["id"])
    db_event.starts_at = datetime(2020, 1, 1, 18, 0, tzinfo=UTC)
    db_session.commit()

    response = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={"note": "Too late"},
    )

    assert response.status_code == 409
