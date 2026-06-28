from datetime import UTC, datetime

import pytest

from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem
from conftest import auth_header, create_board_member, register_member, set_member_approved

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


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


def _prep_task_payload(**overrides):
    payload = {
        "group_name": "Food & Beverage",
        "due_date": "2030-05-20T12:00:00+00:00",
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
    return client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )


def _seed_prep_task_group(db_session, *, group_name: str, labels: list[str]):
    group = PrepTaskGroup(group_name=group_name)
    group.items = [
        PrepTaskGroupItem(label=label, sort_order=index)
        for index, label in enumerate(labels)
    ]
    db_session.add(group)
    db_session.commit()


def test_board_member_can_add_prep_task_to_event(
    client,
    db_session,
    board_member_headers,
):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order catering", "Confirm dietary restrictions"],
    )
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["group_name"] == "Food & Beverage"
    assert body["assignee_id"] is None
    assert len(body["checklist_items"]) == 2
    assert body["checklist_items"][0]["label"] == "Order catering"
    assert body["checklist_items"][1]["label"] == "Confirm dietary restrictions"

    event_response = client.get(
        f"/api/v1/events/{event_id}",
        headers=board_member_headers,
    )
    assert len(event_response.json()["prep_tasks"]) == 1


def test_board_member_can_assign_prep_task_to_board_member(
    client,
    db_session,
    board_member_headers,
):
    from app.models.member import Member

    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    board_member = db_session.query(Member).filter_by(email="board@semo.edu").one()
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(
            group_name="Setup",
            due_date="2030-05-15T12:00:00+00:00",
            assignee_id=board_member.id,
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["assignee_id"] == board_member.id


def test_add_prep_task_rejects_general_member_assignee(
    client,
    db_session,
    board_member_headers,
):
    register_member(client, email="assignee@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="assignee@semo.edu")
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(
            group_name="Setup",
            due_date="2030-05-15T12:00:00+00:00",
            assignee_id=3,
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Assignee must be an approved board member"


def test_unauthenticated_request_gets_401(client, board_member_headers, db_session):
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(group_name="Setup"),
    )

    assert response.status_code == 401


def test_general_member_gets_403(client, general_member_headers, board_member_headers, db_session):
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(group_name="Setup"),
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_add_prep_task_returns_404_for_missing_event(client, board_member_headers, db_session):
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])

    response = client.post(
        "/api/v1/events/999/tasks",
        json=_prep_task_payload(group_name="Setup"),
        headers=board_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"


def test_add_prep_task_returns_404_for_unknown_group(client, board_member_headers):
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(group_name="Unknown Group"),
        headers=board_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Prep task group not found"


@pytest.mark.parametrize(
    "due_date",
    [
        "2020-01-01T12:00:00+00:00",
        "2030-06-01T18:00:00+00:00",
        "2030-06-02T12:00:00+00:00",
    ],
)
def test_add_prep_task_rejects_invalid_due_date(
    client,
    db_session,
    board_member_headers,
    due_date,
):
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(group_name="Setup", due_date=due_date),
        headers=board_member_headers,
    )

    assert response.status_code == 422


def test_add_prep_task_prep_tasks_alias_still_works(
    client,
    db_session,
    board_member_headers,
):
    _seed_prep_task_group(db_session, group_name="Setup", labels=["Reserve room"])
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/prep-tasks",
        json=_prep_task_payload(group_name="Setup"),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["group_name"] == "Setup"


def test_board_member_can_add_prep_task_with_custom_checklist_items(
    client,
    board_member_headers,
):
    event_id = _create_event(client, board_member_headers).json()["id"]

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(
            group_name="Marketing & Outreach",
            checklist_items=[
                "Design Instagram flyer",
                "Post RSVP link to group chat",
            ],
        ),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["group_name"] == "Marketing & Outreach"
    assert [item["label"] for item in body["checklist_items"]] == [
        "Design Instagram flyer",
        "Post RSVP link to group chat",
    ]
