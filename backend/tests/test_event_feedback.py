import pytest

from conftest import auth_header, create_board_member, register_member, set_member_approved


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


def _set_event_past(db_session, event_id: int) -> None:
    from datetime import UTC, datetime

    from app.models.event import Event

    event = db_session.get(Event, event_id)
    event.starts_at = datetime(2020, 1, 1, 18, 0, tzinfo=UTC)
    db_session.commit()


def test_member_can_submit_feedback_for_past_event(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    event = _create_event(client, board_member_headers)
    _set_event_past(db_session, event["id"])

    response = client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
        json={"rating": 5, "comment": "Great event!"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event["id"]
    assert body["rating"] == 5
    assert body["comment"] == "Great event!"
    assert body["created_at"]

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert detail.status_code == 200
    feedback = detail.json()["current_member_feedback"]
    assert feedback is not None
    assert feedback["rating"] == 5
    assert feedback["comment"] == "Great event!"


def test_member_can_edit_existing_feedback(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    event = _create_event(client, board_member_headers)
    _set_event_past(db_session, event["id"])

    first = client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
        json={"rating": 3, "comment": "It was okay."},
    )
    assert first.status_code == 201
    created_at = first.json()["created_at"]

    second = client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
        json={"rating": 5, "comment": "Actually, loved it!"},
    )
    assert second.status_code == 201
    body = second.json()
    assert body["id"] == first.json()["id"]
    assert body["rating"] == 5
    assert body["comment"] == "Actually, loved it!"
    assert body["created_at"] == created_at


def test_feedback_rejected_for_upcoming_event(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
        json={"rating": 4},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Feedback is only available after an event has taken place"
    )


def test_board_can_list_feedback_with_average(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    register_member(client, email="member2@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="member2@semo.edu")
    member2_headers = auth_header(client, email="member2@semo.edu")

    event = _create_event(client, board_member_headers)
    _set_event_past(db_session, event["id"])

    client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
        json={"rating": 5, "comment": "Loved it"},
    )
    client.post(
        f"/api/v1/events/{event['id']}/feedback",
        headers=member2_headers,
        json={"rating": 3, "comment": "Fine"},
    )

    response = client.get(
        f"/api/v1/events/{event['id']}/feedback",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["average_rating"] == 4.0
    assert len(body["feedback"]) == 2
    assert {entry["rating"] for entry in body["feedback"]} == {3, 5}
    assert all(entry["full_name"] for entry in body["feedback"])


def test_general_member_cannot_list_event_feedback(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    event = _create_event(client, board_member_headers)
    _set_event_past(db_session, event["id"])

    response = client.get(
        f"/api/v1/events/{event['id']}/feedback",
        headers=general_member_headers,
    )

    assert response.status_code == 403
