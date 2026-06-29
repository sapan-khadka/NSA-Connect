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


def test_board_member_can_check_checklist_item(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)
    item_id = task["checklist_items"][0]["id"]

    response = client.patch(
        f"/api/v1/tasks/{task['id']}/checklist-items/{item_id}",
        json={"is_completed": True},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["checklist_items"][0]["is_completed"] is True
    assert body["checklist_items"][1]["is_completed"] is False
    assert body["is_complete"] is False


def test_board_member_can_uncheck_checklist_item(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)
    item_ids = [item["id"] for item in task["checklist_items"]]

    for item_id in item_ids:
        client.patch(
            f"/api/v1/tasks/{task['id']}/checklist-items/{item_id}",
            json={"is_completed": True},
            headers=board_member_headers,
        )

    response = client.patch(
        f"/api/v1/tasks/{task['id']}/checklist-items/{item_ids[0]}",
        json={"is_completed": False},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["checklist_items"][0]["is_completed"] is False
    assert body["is_complete"] is False


def test_checking_all_items_marks_task_complete(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)

    for item in task["checklist_items"]:
        response = client.patch(
            f"/api/v1/tasks/{task['id']}/checklist-items/{item['id']}",
            json={"is_completed": True},
            headers=board_member_headers,
        )
        assert response.status_code == 200

    assert response.json()["is_complete"] is True


def test_assignee_can_toggle_checklist_item(
    client,
    db_session,
    board_member_headers,
):
    from app.models.member import Member

    assignee = db_session.query(Member).filter_by(email="board@semo.edu").one()
    task = _create_event_with_task(
        client,
        board_member_headers,
        db_session,
        assignee_id=assignee.id,
    )
    item_id = task["checklist_items"][0]["id"]

    response = client.patch(
        f"/api/v1/tasks/{task['id']}/checklist-items/{item_id}",
        json={"is_completed": True},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["checklist_items"][0]["is_completed"] is True


def test_non_assignee_cannot_toggle_checklist_item(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)
    item_id = task["checklist_items"][0]["id"]

    response = client.patch(
        f"/api/v1/tasks/{task['id']}/checklist-items/{item_id}",
        json={"is_completed": True},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == FORBIDDEN_DETAIL


def test_toggle_checklist_item_returns_404_for_unknown_item(
    client,
    db_session,
    board_member_headers,
):
    task = _create_event_with_task(client, board_member_headers, db_session)

    response = client.patch(
        f"/api/v1/tasks/{task['id']}/checklist-items/99999",
        json={"is_completed": True},
        headers=board_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Checklist item not found"
