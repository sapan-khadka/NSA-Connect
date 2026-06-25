import pytest

from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem
from conftest import auth_header, create_board_member, register_member, set_member_approved

FORBIDDEN_DETAIL = "Not allowed to update this prep task"


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


def _seed_prep_task_group(db_session, *, group_name: str, labels: list[str]):
    group = PrepTaskGroup(group_name=group_name)
    group.items = [
        PrepTaskGroupItem(label=label, sort_order=index)
        for index, label in enumerate(labels)
    ]
    db_session.add(group)
    db_session.commit()


def _create_event_with_task(client, board_headers, db_session, **task_overrides):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order supplies", "Confirm catering"],
    )
    event_response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_headers,
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    task_response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(**task_overrides),
        headers=board_headers,
    )
    assert task_response.status_code == 201
    return task_response.json()


def test_board_member_can_mark_prep_task_complete(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)
    assert task["is_complete"] is False

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"is_complete": True},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["is_complete"] is True
    assert all(item["is_completed"] for item in body["checklist_items"])


def test_board_member_can_assign_prep_task(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    task = _create_event_with_task(client, board_member_headers, db_session)

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_id": assignee.id},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["assignee_id"] == assignee.id


def test_board_member_can_update_completion_and_assignee_together(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    task = _create_event_with_task(client, board_member_headers, db_session)

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"is_complete": True, "assignee_id": assignee.id},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["is_complete"] is True
    assert body["assignee_id"] == assignee.id


def test_board_member_can_unassign_prep_task(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    task = _create_event_with_task(
        client,
        board_member_headers,
        db_session,
        assignee_id=assignee.id,
    )
    assert task["assignee_id"] == assignee.id

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_id": None},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["assignee_id"] is None


def test_assignee_can_mark_own_prep_task_complete(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    task = _create_event_with_task(
        client,
        board_member_headers,
        db_session,
        assignee_id=assignee.id,
    )

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"is_complete": True},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_complete"] is True


def test_assignee_cannot_change_assignee(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    other_member = db_session.query(Member).filter_by(email="other@semo.edu").one()
    task = _create_event_with_task(
        client,
        board_member_headers,
        db_session,
        assignee_id=assignee.id,
    )

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_id": other_member.id},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == FORBIDDEN_DETAIL


def test_non_assignee_cannot_update_prep_task(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"is_complete": True},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == FORBIDDEN_DETAIL


def test_update_prep_task_returns_404_for_unknown_task(
    client,
    board_member_headers,
):
    response = client.patch(
        "/api/v1/tasks/99999",
        json={"is_complete": True},
        headers=board_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Prep task not found"


def test_update_prep_task_requires_at_least_one_field(
    client,
    board_member_headers,
):
    response = client.patch(
        "/api/v1/tasks/1",
        json={},
        headers=board_member_headers,
    )

    assert response.status_code == 422


def test_update_prep_task_rejects_invalid_assignee(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_id": 99999},
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Assignee must be an approved member"
