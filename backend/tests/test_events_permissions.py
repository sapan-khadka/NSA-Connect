import pytest

from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem
from conftest import auth_header, create_board_member, register_member, set_member_approved

BOARD_REQUIRED_DETAIL = "Requires board role or higher"
TASK_FORBIDDEN_DETAIL = "Not allowed to update this prep task"


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


@pytest.fixture
def event_id(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def _seed_prep_task_group(db_session, *, group_name: str, labels: list[str]):
    group = PrepTaskGroup(group_name=group_name)
    group.items = [
        PrepTaskGroupItem(label=label, sort_order=index)
        for index, label in enumerate(labels)
    ]
    db_session.add(group)
    db_session.commit()


@pytest.fixture
def prep_task_id(client, board_member_headers, db_session, event_id):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order supplies", "Confirm catering"],
    )
    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(),
        headers=board_member_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_request_gets_401_on_event_create(client):
    response = client.post("/api/v1/events", json=_event_payload())

    assert response.status_code == 401


def test_unauthenticated_request_gets_401_on_event_list(client):
    response = client.get("/api/v1/events")

    assert response.status_code == 401


def test_unauthenticated_request_gets_401_on_event_detail(client, event_id):
    response = client.get(f"/api/v1/events/{event_id}")

    assert response.status_code == 401


def test_general_member_cannot_create_event(client, general_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_board_member_can_create_event(client, board_member_headers):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Dashain Celebration"


def test_general_member_can_list_events(
    client,
    board_member_headers,
    general_member_headers,
    event_id,
):
    response = client.get("/api/v1/events", headers=general_member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["events"][0]["id"] == event_id


def test_general_member_can_get_event_detail(
    client,
    general_member_headers,
    event_id,
):
    response = client.get(
        f"/api/v1/events/{event_id}",
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == event_id
    assert response.json()["prep_tasks"] == []


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/events/{event_id}/tasks",
        "/api/v1/events/{event_id}/prep-tasks",
    ],
)
def test_general_member_cannot_add_prep_task(
    client,
    db_session,
    general_member_headers,
    event_id,
    path,
):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order supplies"],
    )

    response = client.post(
        path.format(event_id=event_id),
        json=_prep_task_payload(),
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_board_member_can_add_prep_task(
    client,
    db_session,
    board_member_headers,
    event_id,
):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order supplies"],
    )

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(),
        headers=board_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["group_name"] == "Food & Beverage"


def test_unauthenticated_request_gets_401_on_add_prep_task(
    client,
    db_session,
    event_id,
):
    _seed_prep_task_group(
        db_session,
        group_name="Food & Beverage",
        labels=["Order supplies"],
    )

    response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(),
    )

    assert response.status_code == 401


def test_general_member_cannot_update_unassigned_prep_task(
    client,
    general_member_headers,
    prep_task_id,
):
    response = client.patch(
        f"/api/v1/tasks/{prep_task_id}",
        json={"is_complete": True},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == TASK_FORBIDDEN_DETAIL


def test_general_member_cannot_reassign_prep_task(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
    event_id,
):
    from app.models.member import Member

    _seed_prep_task_group(
        db_session,
        group_name="Setup",
        labels=["Reserve room"],
    )
    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()
    other_member = db_session.query(Member).filter_by(email="other@semo.edu").one()

    create_response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(
            group_name="Setup",
            assignee_id=assignee.id,
        ),
        headers=board_member_headers,
    )
    task_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"assignee_id": other_member.id},
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == TASK_FORBIDDEN_DETAIL


def test_assignee_can_mark_assigned_prep_task_complete(
    client,
    db_session,
    board_member_headers,
    general_member_headers,
    event_id,
):
    from app.models.member import Member

    _seed_prep_task_group(
        db_session,
        group_name="Setup",
        labels=["Reserve room"],
    )
    assignee = db_session.query(Member).filter_by(email="sapan@semo.edu").one()

    create_response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json=_prep_task_payload(
            group_name="Setup",
            assignee_id=assignee.id,
        ),
        headers=board_member_headers,
    )
    task_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"is_complete": True},
        headers=general_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_complete"] is True


def test_board_member_can_update_prep_task(
    client,
    board_member_headers,
    prep_task_id,
):
    response = client.patch(
        f"/api/v1/tasks/{prep_task_id}",
        json={"is_complete": True},
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_complete"] is True


def test_unauthenticated_request_gets_401_on_update_prep_task(client, prep_task_id):
    response = client.patch(
        f"/api/v1/tasks/{prep_task_id}",
        json={"is_complete": True},
    )

    assert response.status_code == 401
