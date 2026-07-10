import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

DISCUSSION_FORBIDDEN = "You do not have access to this discussion"


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-10-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Community celebration",
        "budget": "200.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def second_general_headers(client, db_session):
    register_member(
        client,
        email="volunteer2@semo.edu",
        student_id="33333333",
    )
    set_member_approved(db_session, email="volunteer2@semo.edu")
    return auth_header(client, email="volunteer2@semo.edu")


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


def test_board_member_can_post_in_event_and_board_channels(
    client,
    board_member_headers,
):
    event = _create_event(client, board_member_headers)

    event_post = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={"content": "Board note for this event"},
        headers=board_member_headers,
    )
    assert event_post.status_code == 201
    assert event_post.json()["content"] == "Board note for this event"
    assert event_post.json()["event_id"] == event["id"]

    board_post = client.post(
        "/api/v1/board/discussion",
        json={"content": "General board update"},
        headers=board_member_headers,
    )
    assert board_post.status_code == 201
    assert board_post.json()["event_id"] is None

    event_list = client.get(
        f"/api/v1/events/{event['id']}/discussion",
        headers=board_member_headers,
    )
    assert event_list.status_code == 200
    assert len(event_list.json()["messages"]) == 1

    board_list = client.get(
        "/api/v1/board/discussion",
        headers=board_member_headers,
    )
    assert board_list.status_code == 200
    assert len(board_list.json()["messages"]) == 1


def test_volunteer_can_post_in_event_thread_but_not_board_or_other_events(
    client,
    board_member_headers,
    general_member_headers,
    second_general_headers,
):
    event_a = _create_event(client, board_member_headers, name="Event A")
    event_b = _create_event(client, board_member_headers, name="Event B")

    signup = client.post(
        f"/api/v1/events/{event_a['id']}/volunteer-signup",
        headers=general_member_headers,
        json={},
    )
    assert signup.status_code == 201

    allowed = client.post(
        f"/api/v1/events/{event_a['id']}/discussion",
        json={"content": "Happy to help with setup"},
        headers=general_member_headers,
    )
    assert allowed.status_code == 201

    other_event = client.post(
        f"/api/v1/events/{event_b['id']}/discussion",
        json={"content": "Should not work"},
        headers=general_member_headers,
    )
    assert other_event.status_code == 403
    assert other_event.json()["detail"] == DISCUSSION_FORBIDDEN

    board_channel = client.post(
        "/api/v1/board/discussion",
        json={"content": "Should not work"},
        headers=general_member_headers,
    )
    assert board_channel.status_code == 403

    # Non-volunteer cannot view either.
    blocked_view = client.get(
        f"/api/v1/events/{event_a['id']}/discussion",
        headers=second_general_headers,
    )
    assert blocked_view.status_code == 403


def test_non_volunteer_cannot_view_or_post_event_discussion(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    view = client.get(
        f"/api/v1/events/{event['id']}/discussion",
        headers=general_member_headers,
    )
    assert view.status_code == 403

    post = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={"content": "Nope"},
        headers=general_member_headers,
    )
    assert post.status_code == 403


def test_closed_meeting_discussion_is_board_only(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(
        client,
        board_member_headers,
        name="Closed Board Meeting",
        event_type="meeting",
        meeting_visibility="board_only",
    )

    # Volunteer signup itself is blocked by closed-meeting visibility.
    signup = client.post(
        f"/api/v1/events/{event['id']}/volunteer-signup",
        headers=general_member_headers,
        json={},
    )
    assert signup.status_code == 404

    view = client.get(
        f"/api/v1/events/{event['id']}/discussion",
        headers=general_member_headers,
    )
    assert view.status_code == 404

    board_post = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={"content": "Agenda notes"},
        headers=board_member_headers,
    )
    assert board_post.status_code == 201


def test_discussion_poll_returns_only_newer_messages(
    client,
    board_member_headers,
):
    event = _create_event(client, board_member_headers)

    first = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={"content": "First"},
        headers=board_member_headers,
    ).json()
    second = client.post(
        f"/api/v1/events/{event['id']}/discussion",
        json={"content": "Second"},
        headers=board_member_headers,
    ).json()

    polled = client.get(
        f"/api/v1/events/{event['id']}/discussion",
        params={"after_id": first["id"]},
        headers=board_member_headers,
    )
    assert polled.status_code == 200
    messages = polled.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["id"] == second["id"]
    assert messages[0]["content"] == "Second"


def test_empty_discussion_content_rejected(client, board_member_headers):
    response = client.post(
        "/api/v1/board/discussion",
        json={"content": "   "},
        headers=board_member_headers,
    )
    assert response.status_code == 422
