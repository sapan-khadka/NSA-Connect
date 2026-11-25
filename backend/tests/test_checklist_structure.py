from datetime import UTC, datetime

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event
from app.models.event_task import EventTask
from app.models.member import Member
from app.models.organization import Organization, OrganizationStatus
from app.services.organization_context import get_default_organization_id


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


def _checklist_payload(**overrides):
    payload = {
        "group_name": "Setup",
        "due_date": "2030-05-20T12:00:00+00:00",
        "assignee_id": None,
        "checklist_items": ["Reserve room", "Test AV"],
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def board_headers(client, db_session):
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def general_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _create_checklist(client, headers, **event_overrides):
    event = client.post(
        "/api/v1/events",
        json=_event_payload(**event_overrides),
        headers=headers,
    )
    assert event.status_code == 201
    event_body = event.json()
    task = client.post(
        f"/api/v1/events/{event_body['id']}/tasks",
        json=_checklist_payload(),
        headers=headers,
    )
    assert task.status_code == 201, task.text
    return event_body, task.json()


def test_edit_keeps_completion_and_reorder_keeps_rows(client, board_headers):
    _, task = _create_checklist(client, board_headers)
    first, second = task["checklist_items"]

    completed = client.patch(
        f"/api/v1/event-tasks/{task['id']}/checklist-items/{first['id']}",
        json={"is_completed": True},
        headers=board_headers,
    )
    assert completed.status_code == 200

    renamed = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Room setup",
            "items": [
                {"id": second["id"], "label": "Test AV"},
                {"id": first["id"], "label": "Book the auditorium"},
                {"id": None, "label": "Print signs"},
            ],
        },
        headers=board_headers,
    )
    assert renamed.status_code == 200, renamed.text
    body = renamed.json()
    assert body["title"] == "Room setup"
    assert body["group_name"] == "Room setup"
    assert body["assignee_id"] == task["assignee_id"]
    assert body["due_date"] == task["due_date"]
    assert [item["label"] for item in body["checklist_items"]] == [
        "Test AV",
        "Book the auditorium",
        "Print signs",
    ]
    by_id = {item["id"]: item for item in body["checklist_items"]}
    assert by_id[first["id"]]["is_completed"] is True
    assert by_id[second["id"]]["is_completed"] is False
    assert by_id[first["id"]]["sort_order"] == 1
    assert body["checklist_items"][2]["is_completed"] is False
    assert body["is_complete"] is False

    removed = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Room setup",
            "items": [{"id": first["id"], "label": "Book the auditorium"}],
        },
        headers=board_headers,
    )
    assert removed.status_code == 200
    saved = removed.json()
    assert saved["is_complete"] is True
    assert len(saved["checklist_items"]) == 1
    assert saved["checklist_items"][0]["id"] == first["id"]
    assert saved["checklist_items"][0]["is_completed"] is True


def test_rename_keeps_assignee_and_due_date(client, db_session, board_headers):
    _, task = _create_checklist(client, board_headers)
    assignee = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assigned = client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"assignee_id": assignee.id},
        headers=board_headers,
    )
    assert assigned.status_code == 200

    renamed = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Venue",
            "items": [
                {"id": item["id"], "label": item["label"]}
                for item in task["checklist_items"]
            ],
        },
        headers=board_headers,
    )
    assert renamed.status_code == 200
    body = renamed.json()
    assert body["title"] == "Venue"
    assert body["assignee_id"] == assignee.id
    assert body["due_date"] == task["due_date"]
    assert [item["id"] for item in body["checklist_items"]] == [
        item["id"] for item in task["checklist_items"]
    ]


def test_assignee_can_complete_items_but_not_change_structure(
    client,
    db_session,
    board_headers,
    general_headers,
):
    event, task = _create_checklist(client, board_headers)
    general = db_session.scalar(
        select(Member).where(Member.email == "sapan@semo.edu"),
    )
    event_task_items = task["checklist_items"]
    stored_task = db_session.get(EventTask, task["id"])
    stored_task.assignee_id = general.id
    db_session.commit()

    toggled = client.patch(
        f"/api/v1/event-tasks/{task['id']}/checklist-items/{event_task_items[0]['id']}",
        json={"is_completed": True},
        headers=general_headers,
    )
    assert toggled.status_code == 200

    rejected = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Changed by assignee",
            "items": [
                {"id": item["id"], "label": item["label"]} for item in event_task_items
            ],
        },
        headers=general_headers,
    )
    assert rejected.status_code == 403

    current = client.get(
        f"/api/v1/events/{event['id']}/event-tasks",
        headers=board_headers,
    )
    saved = next(entry for entry in current.json()["tasks"] if entry["id"] == task["id"])
    assert saved["title"] == "Setup"
    assert saved["checklist_items"][0]["is_completed"] is True


def test_other_organization_cannot_edit_or_extend_a_checklist(
    client,
    db_session,
    board_headers,
):
    event, task = _create_checklist(client, board_headers)
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    stored_event = db_session.get(Event, event["id"])
    stored_event.organization_id = other.id
    db_session.commit()

    rejected = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Stolen",
            "items": [{"id": task["checklist_items"][0]["id"], "label": "Stolen"}],
        },
        headers=board_headers,
    )
    assert rejected.status_code == 404

    added = client.post(
        f"/api/v1/events/{event['id']}/tasks",
        json=_checklist_payload(group_name="Extra"),
        headers=board_headers,
    )
    assert added.status_code == 404


def test_failed_structure_save_leaves_the_checklist_unchanged(client, board_headers):
    event, task = _create_checklist(client, board_headers)
    rejected = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Should not save",
            "items": [{"id": 999999, "label": "Missing item"}],
        },
        headers=board_headers,
    )
    assert rejected.status_code == 422

    current = client.get(
        f"/api/v1/events/{event['id']}/event-tasks",
        headers=board_headers,
    )
    saved = next(entry for entry in current.json()["tasks"] if entry["id"] == task["id"])
    assert saved["title"] == "Setup"
    assert [item["label"] for item in saved["checklist_items"]] == [
        "Reserve room",
        "Test AV",
    ]


def test_past_event_rejects_new_categories_and_keeps_existing_edits(
    client,
    db_session,
    board_headers,
):
    event, task = _create_checklist(client, board_headers)
    stored_event = db_session.get(Event, event["id"])
    stored_event.starts_at = datetime(2020, 1, 1, tzinfo=UTC)
    db_session.commit()

    added = client.post(
        f"/api/v1/events/{event['id']}/tasks",
        json=_checklist_payload(group_name="Late category"),
        headers=board_headers,
    )
    assert added.status_code == 400

    edited = client.put(
        f"/api/v1/event-tasks/{task['id']}/checklist",
        json={
            "title": "Setup",
            "items": [
                {"id": task["checklist_items"][0]["id"], "label": "Reserve the hall"},
                {"id": task["checklist_items"][1]["id"], "label": "Test AV"},
            ],
        },
        headers=board_headers,
    )
    assert edited.status_code == 200
    assert edited.json()["checklist_items"][0]["label"] == "Reserve the hall"


def test_only_task_managers_can_delete_a_checklist_category(
    client,
    db_session,
    board_headers,
):
    _, task = _create_checklist(client, board_headers)
    denied = client.delete(
        f"/api/v1/event-tasks/{task['id']}",
        headers=board_headers,
    )
    assert denied.status_code == 403

    create_president_member(db_session)
    president_headers = auth_header(client, email="president@semo.edu")
    deleted = client.delete(
        f"/api/v1/event-tasks/{task['id']}",
        headers=president_headers,
    )
    assert deleted.status_code == 204
