"""Resolve real object IDs and request bodies for restricted-endpoint auth probes."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from conftest import create_president_member
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.event_suggestion import EventSuggestion, EventSuggestionStatus
from app.models.member import Member
from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem


@dataclass
class ProbeContext:
    event_id: int
    meeting_event_id: int
    member_id: int
    announcement_id: int
    report_id: int
    suggestion_id: int
    finance_entry_id: int
    finance_change_request_id: int
    dues_id: int
    prep_task_id: int
    checklist_item_id: int
    event_task_id: int
    slot_id: int


def _event_payload(**overrides):
    payload = {
        "name": "Probe Cultural Event",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Authorization probe fixture event.",
        "budget": "100.00",
    }
    payload.update(overrides)
    return payload


def _meeting_payload(**overrides):
    payload = {
        "name": "Probe Board Meeting",
        "starts_at": "2030-07-01T18:00:00+00:00",
        "event_type": "meeting",
        "description": "Authorization probe meeting.",
        "budget": "0.00",
        "meeting_visibility": "board_only",
    }
    payload.update(overrides)
    return payload


def build_probe_context(
    client: TestClient,
    db_session: Session,
    *,
    board_headers: dict[str, str],
    treasurer_headers: dict[str, str],
    general_member: Member,
) -> ProbeContext:
    event = client.post(
        "/api/v1/events",
        json=_event_payload(),
        headers=board_headers,
    )
    assert event.status_code == 201, event.text
    event_id = event.json()["id"]

    meeting = client.post(
        "/api/v1/events",
        json=_meeting_payload(),
        headers=board_headers,
    )
    assert meeting.status_code == 201, meeting.text
    meeting_event_id = meeting.json()["id"]

    announcement = client.post(
        "/api/v1/announcements",
        json={
            "title": "Probe Announcement",
            "body": "Probe body",
            "category": "general",
        },
        headers=board_headers,
    )
    assert announcement.status_code == 201, announcement.text
    announcement_id = announcement.json()["id"]

    report = client.post(
        "/api/v1/reports",
        json={"range_type": "semester", "semester": "2026-spring"},
        headers=board_headers,
    )
    assert report.status_code == 201, report.text
    report_id = report.json()["id"]

    suggestion = EventSuggestion(
        title="Probe Suggestion",
        description="Suggestion for auth probes",
        suggested_by_id=general_member.id,
        status=EventSuggestionStatus.SUBMITTED,
        created_at=datetime.now(UTC),
    )
    db_session.add(suggestion)
    db_session.commit()
    db_session.refresh(suggestion)

    finance_entry = client.post(
        "/api/v1/finance",
        json={
            "entry_type": "expense",
            "category": "food_beverage",
            "amount": "25.00",
            "description": "Probe entry",
        },
        headers=treasurer_headers,
    )
    assert finance_entry.status_code == 201, finance_entry.text
    finance_entry_id = finance_entry.json()["id"]

    change_request = client.patch(
        f"/api/v1/finance/{finance_entry_id}",
        json={"amount": "30.00", "description": "Probe update"},
        headers=treasurer_headers,
    )
    assert change_request.status_code == 202, change_request.text
    finance_change_request_id = change_request.json()["id"]

    client.put(
        "/api/v1/finance/dues/settings",
        json={"semester": "2026-spring", "default_amount": "25.00"},
        headers=treasurer_headers,
    )
    generate_dues = client.post(
        "/api/v1/finance/dues/generate",
        json={"semester": "2026-spring"},
        headers=treasurer_headers,
    )
    assert generate_dues.status_code == 200, generate_dues.text

    dashboard = client.get(
        "/api/v1/finance/dues?semester=2026-spring",
        headers=treasurer_headers,
    )
    assert dashboard.status_code == 200, dashboard.text
    dues_id = dashboard.json()["records"][0]["id"]

    group = PrepTaskGroup(group_name="Probe Setup")
    group.items = [PrepTaskGroupItem(label="Reserve room", sort_order=0)]
    db_session.add(group)
    db_session.commit()

    prep_task = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json={
            "group_name": "Probe Setup",
            "due_date": "2030-05-20T12:00:00+00:00",
        },
        headers=board_headers,
    )
    assert prep_task.status_code == 201, prep_task.text
    prep_task_id = prep_task.json()["id"]
    checklist_item_id = prep_task.json()["checklist_items"][0]["id"]

    president = create_president_member(
        db_session,
        email="probe-president@semo.edu",
        student_id="11223344",
    )
    president_login = client.post(
        "/api/v1/auth/login",
        json={"email": president.email, "password": "securepass123"},
    )
    president_headers = {
        "Authorization": f"Bearer {president_login.json()['access_token']}"
    }

    event_task = client.post(
        f"/api/v1/events/{event_id}/event-tasks",
        json={
            "title": "Probe task",
            "description": "Task for auth probes",
            "due_date": "2030-05-25T12:00:00+00:00",
        },
        headers=president_headers,
    )
    assert event_task.status_code == 201, event_task.text
    event_task_id = event_task.json()["id"]

    slot = client.post(
        f"/api/v1/events/{event_id}/slots",
        json={"task_name": "Probe slot", "max_signup_count": 3},
        headers=board_headers,
    )
    assert slot.status_code == 201, slot.text
    slot_id = slot.json()["id"]

    return ProbeContext(
        event_id=event_id,
        meeting_event_id=meeting_event_id,
        member_id=general_member.id,
        announcement_id=announcement_id,
        report_id=report_id,
        suggestion_id=suggestion.id,
        finance_entry_id=finance_entry_id,
        finance_change_request_id=finance_change_request_id,
        dues_id=dues_id,
        prep_task_id=prep_task_id,
        checklist_item_id=checklist_item_id,
        event_task_id=event_task_id,
        slot_id=slot_id,
    )


def resolve_probe_path(path_template: str, ctx: ProbeContext) -> str:
    if "{event_id}" in path_template and "/meeting" in path_template:
        event_id = ctx.meeting_event_id
    elif "{event_id}" in path_template:
        event_id = ctx.event_id
    else:
        event_id = None

    if "/event-tasks/{task_id}" in path_template:
        task_id = ctx.event_task_id
    elif "{task_id}" in path_template:
        task_id = ctx.prep_task_id
    else:
        task_id = None

    replacements = {
        "{member_id}": str(ctx.member_id),
        "{announcement_id}": str(ctx.announcement_id),
        "{report_id}": str(ctx.report_id),
        "{suggestion_id}": str(ctx.suggestion_id),
        "{entry_id}": str(ctx.finance_entry_id),
        "{request_id}": str(ctx.finance_change_request_id),
        "{dues_id}": str(ctx.dues_id),
        "{item_id}": str(ctx.checklist_item_id),
        "{slot_id}": str(ctx.slot_id),
        "{photo_id}": "1",
    }
    if event_id is not None:
        replacements["{event_id}"] = str(event_id)
    if task_id is not None:
        replacements["{task_id}"] = str(task_id)

    path = path_template
    for key, value in replacements.items():
        path = path.replace(key, value)
    return path


def probe_request_kwargs(method: str, path_template: str) -> dict:
    kwargs: dict = {}
    if method not in {"POST", "PATCH", "PUT", "DELETE"}:
        return kwargs

    if path_template == "/api/v1/reports" and method == "POST":
        kwargs["json"] = {"range_type": "semester", "semester": "2026-spring"}
    elif path_template == "/api/v1/announcements" and method == "POST":
        kwargs["json"] = {
            "title": "Probe",
            "body": "Probe",
            "category": "general",
        }
    elif (
        path_template.endswith("/announcements/{announcement_id}") and method == "PATCH"
    ):
        kwargs["json"] = {"title": "Updated"}
    elif path_template == "/api/v1/events" and method == "POST":
        kwargs["json"] = _event_payload(name="Probe Create Event")
    elif path_template.endswith("/events/{event_id}") and method == "PATCH":
        kwargs["json"] = {"name": "Renamed Probe Event"}
    elif path_template.endswith("/events/{event_id}/tasks") and method == "POST":
        kwargs["json"] = {
            "group_name": "Probe Setup",
            "due_date": "2030-05-20T12:00:00+00:00",
        }
    elif path_template.endswith("/events/{event_id}/prep-tasks") and method == "POST":
        kwargs["json"] = {
            "group_name": "Probe Setup",
            "due_date": "2030-05-20T12:00:00+00:00",
        }
    elif path_template.endswith("/events/{event_id}/slots") and method == "POST":
        kwargs["json"] = {"task_name": "Probe slot", "max_signup_count": 2}
    elif (
        path_template.endswith("/events/{event_id}/invited-participants")
        and method == "POST"
    ):
        kwargs["json"] = {"member_ids": [1]}
    elif path_template.endswith("/events/{event_id}/event-tasks") and method == "POST":
        kwargs["json"] = {
            "title": "Probe",
            "description": "Probe",
            "due_date": "2030-05-25T12:00:00+00:00",
        }
    elif (
        path_template.endswith("/event-suggestions/{suggestion_id}/status")
        and method == "PATCH"
    ):
        kwargs["json"] = {"status": "noted"}
    elif path_template.endswith("/members/{member_id}/role") and method == "PATCH":
        kwargs["json"] = {"role": "board"}
    elif path_template.endswith("/members/{member_id}/position") and method == "PATCH":
        kwargs["json"] = {"position": "member"}
    elif path_template.endswith("/members/{member_id}/approve") and method == "PATCH":
        kwargs["json"] = {}
    elif path_template.endswith("/members/{member_id}/reject") and method == "PATCH":
        kwargs["json"] = {}
    elif path_template.endswith("/members/{member_id}") and method == "PATCH":
        kwargs["json"] = {"major": "Biology"}
    elif path_template == "/api/v1/finance" and method == "POST":
        kwargs["json"] = {
            "entry_type": "expense",
            "category": "food_beverage",
            "amount": "10.00",
            "description": "Probe",
        }
    elif path_template.endswith("/finance/{entry_id}") and method == "PATCH":
        kwargs["json"] = {"description": "Probe patch"}
    elif path_template.endswith("/finance/dues/{dues_id}") and method == "PATCH":
        kwargs["json"] = {"amount_owed": "25.00"}
    elif path_template.endswith("/mark-paid") and method == "POST":
        kwargs["json"] = {}
    elif path_template.endswith("/mark-unpaid") and method == "POST":
        kwargs["json"] = {}
    elif "change-requests" in path_template and method == "POST":
        kwargs["json"] = {}
    elif path_template.endswith("/meeting/notes") and method == "PUT":
        kwargs["json"] = {"notes": "Probe notes"}
    elif path_template.endswith("/meeting/attendance") and method == "PUT":
        kwargs["json"] = {"entries": []}
    elif path_template.endswith("/meeting/summarize") and method == "POST":
        kwargs["json"] = {}
    elif path_template == "/api/v1/ai/generate-checklist" and method == "POST":
        kwargs["json"] = {"event_id": 1, "group_names": ["Food"]}
    elif path_template == "/api/v1/ai/draft-announcement-email" and method == "POST":
        kwargs["json"] = {"event_id": 1}
    elif path_template == "/api/v1/ai/summarize-minutes" and method == "POST":
        kwargs["json"] = {"notes": "Probe minutes"}
    elif path_template == "/api/v1/notifications/test-email" and method == "POST":
        kwargs["json"] = {}
    elif path_template == "/api/v1/notifications/run-check" and method == "POST":
        kwargs["json"] = {}
    elif path_template.endswith("/event-tasks/{task_id}") and method == "PATCH":
        kwargs["json"] = {"status": "in_progress"}
    elif path_template.endswith("/tasks/{task_id}") and method == "PATCH":
        kwargs["json"] = {"is_complete": True}
    elif "checklist-items" in path_template and method == "PATCH":
        kwargs["json"] = {"is_completed": True}
    elif path_template == "/api/v1/finance/receipts" and method == "POST":
        kwargs["files"] = {
            "file": ("receipt.jpg", b"\xff\xd8\xffprobe", "image/jpeg"),
        }
    elif path_template == "/api/v1/constitution/upload" and method == "POST":
        kwargs["files"] = {
            "file": ("constitution.pdf", b"%PDF-1.4 probe", "application/pdf"),
        }
    else:
        kwargs["json"] = {}

    return kwargs
