import pytest

from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night.",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def president_headers(client, db_session):
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session)


@pytest.fixture
def board_headers(client, board_member):
    return auth_header(client, email="board@semo.edu")


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _create_task(client, headers, event_id, **overrides):
    payload = {"title": "Book the venue"}
    payload.update(overrides)
    response = client.post(
        f"/api/v1/events/{event_id}/event-tasks",
        json=payload,
        headers=headers,
    )
    return response


def test_president_can_create_and_assign_task(
    client,
    president_headers,
    board_member,
):
    event = _create_event(client, president_headers)

    response = _create_task(
        client,
        president_headers,
        event["id"],
        title="Print flyers",
        description="100 color copies",
        assignee_id=board_member.id,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Print flyers"
    assert body["assignee_id"] == board_member.id
    assert body["assignee_name"] == board_member.full_name
    assert body["status"] == "todo"
    assert body["event_name"] == "Dashain Celebration"


def test_plain_board_member_cannot_create_task(
    client,
    president_headers,
    board_headers,
):
    event = _create_event(client, president_headers)

    response = _create_task(client, board_headers, event["id"])
    assert response.status_code == 403


def test_event_manager_position_can_create_task(
    client,
    db_session,
    president_headers,
    board_member,
    board_headers,
):
    from app.models.member import MemberPosition

    board_member.position = MemberPosition.EVENT_MANAGER
    db_session.commit()

    event = _create_event(client, president_headers)
    response = _create_task(client, board_headers, event["id"])
    assert response.status_code == 201


def test_create_task_with_invalid_assignee_returns_400(
    client,
    db_session,
    president_headers,
):
    register_member(client)
    set_member_approved(db_session)
    general = client.get("/api/v1/members/me", headers=auth_header(client)).json()

    event = _create_event(client, president_headers)
    response = _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=general["id"],
    )
    assert response.status_code == 400


def test_mine_returns_only_assigned_tasks(
    client,
    president_headers,
    board_member,
    board_headers,
):
    event = _create_event(client, president_headers)
    _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    )

    mine = client.get("/api/v1/event-tasks/mine", headers=board_headers)
    assert mine.status_code == 200
    assert mine.json()["total"] == 1

    president_mine = client.get("/api/v1/event-tasks/mine", headers=president_headers)
    assert president_mine.json()["total"] == 0


def test_assignee_can_complete_with_note(
    client,
    president_headers,
    board_member,
    board_headers,
):
    event = _create_event(client, president_headers)
    task = _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    ).json()

    response = client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done", "completion_note": "All set"},
        headers=board_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "done"
    assert body["completion_note"] == "All set"
    assert body["completed_at"] is not None


def test_board_member_can_edit_task_fields(
    client,
    president_headers,
    board_member,
    board_headers,
):
    event = _create_event(client, president_headers)
    task = _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    ).json()

    response = client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"title": "Updated title"},
        headers=board_headers,
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


def test_unrelated_member_cannot_update_task(
    client,
    db_session,
    president_headers,
):
    register_member(client)
    set_member_approved(db_session)
    general_headers = auth_header(client)

    event = _create_event(client, president_headers)
    task = _create_task(client, president_headers, event["id"]).json()

    response = client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done"},
        headers=general_headers,
    )
    assert response.status_code == 403


def test_overview_access_control(client, president_headers, board_headers):
    president = client.get("/api/v1/event-tasks/overview", headers=president_headers)
    assert president.status_code == 200

    board = client.get("/api/v1/event-tasks/overview", headers=board_headers)
    assert board.status_code == 403


def test_vice_president_position_can_view_overview(
    client,
    db_session,
    board_member,
    board_headers,
):
    from app.models.member import MemberPosition

    board_member.position = MemberPosition.VICE_PRESIDENT
    db_session.commit()

    response = client.get("/api/v1/event-tasks/overview", headers=board_headers)
    assert response.status_code == 200


def test_overview_reports_completion(
    client,
    president_headers,
    board_member,
    board_headers,
):
    event = _create_event(client, president_headers)
    task = _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    ).json()
    client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done"},
        headers=board_headers,
    )

    overview = client.get(
        "/api/v1/event-tasks/overview",
        headers=president_headers,
    ).json()

    assert overview["total_tasks"] == 1
    assert overview["completed_tasks"] == 1
    board_row = next(
        row for row in overview["members"] if row["member_id"] == board_member.id
    )
    assert board_row["total"] == 1
    assert board_row["completed"] == 1
    assert board_row["completion_percent"] == 100


def test_task_manager_can_delete_task(
    client,
    president_headers,
    board_member,
    board_headers,
):
    event = _create_event(client, president_headers)
    task = _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    ).json()

    response = client.delete(
        f"/api/v1/event-tasks/{task['id']}",
        headers=president_headers,
    )
    assert response.status_code == 204

    mine = client.get("/api/v1/event-tasks/mine", headers=board_headers)
    assert mine.json()["total"] == 0


def test_board_member_can_upload_task_photo(client, board_headers):
    response = client.post(
        "/api/v1/event-tasks/uploads",
        files={"file": ("done.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=board_headers,
    )
    assert response.status_code == 201
    assert response.json()["photo_url"].startswith("https://")


def test_list_event_tasks_for_event(
    client,
    president_headers,
    board_member,
):
    event = _create_event(client, president_headers)
    _create_task(
        client,
        president_headers,
        event["id"],
        assignee_id=board_member.id,
    )

    response = client.get(
        f"/api/v1/events/{event['id']}/event-tasks",
        headers=president_headers,
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
