from datetime import UTC, datetime

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from tests.helpers.task_fixtures import seed_checklist_event_task


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


def _create_event(client, headers, **overrides):
    return client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )


def _seed_prep_task(
    db_session,
    *,
    event_id: int,
    group_name: str,
    label: str,
    due_date: datetime,
):
    seed_checklist_event_task(
        db_session,
        event_id=event_id,
        group_name=group_name,
        label=label,
        due_date=due_date,
    )


def test_get_event_requires_authentication(client, board_member_headers):
    create_response = _create_event(client, board_member_headers)
    event_id = create_response.json()["id"]

    response = client.get(f"/api/v1/events/{event_id}")

    assert response.status_code == 401


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


def test_get_event_returns_nested_prep_tasks(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    create_response = _create_event(client, board_member_headers)
    event_id = create_response.json()["id"]

    _seed_prep_task(
        db_session,
        event_id=event_id,
        group_name="Food & Beverage",
        label="Order catering",
        due_date=datetime(2030, 5, 20, 12, 0, tzinfo=UTC),
    )
    _seed_prep_task(
        db_session,
        event_id=event_id,
        group_name="Setup",
        label="Reserve room",
        due_date=datetime(2030, 5, 25, 12, 0, tzinfo=UTC),
    )

    response = client.get(
        f"/api/v1/events/{event_id}",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Dashain Celebration"
    assert body["event_type"] == "cultural"
    assert len(body["prep_tasks"]) == 2
    assert body["prep_tasks"][0]["group_name"] == "Food & Beverage"
    assert body["prep_tasks"][0]["checklist_items"][0]["label"] == "Order catering"
    assert body["prep_tasks"][1]["group_name"] == "Setup"


def test_get_event_returns_empty_prep_tasks_when_none_exist(
    client,
    board_member_headers,
    general_member_headers,
):
    create_response = _create_event(client, board_member_headers)
    event_id = create_response.json()["id"]

    response = client.get(
        f"/api/v1/events/{event_id}",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["prep_tasks"] == []


def test_get_event_returns_404_for_missing_event(client, general_member_headers):
    response = client.get("/api/v1/events/999", headers=general_member_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"
