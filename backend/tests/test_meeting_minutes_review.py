from datetime import UTC, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from conftest import auth_header, create_board_member, register_member
from sqlalchemy import func, select

from app.core.security import hash_password
from app.models.event import Event
from app.models.event_task import EventTask
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.organization import Organization, OrganizationStatus
from app.services.meeting_service import (
    MEETING_DRAFT_CONFLICT_DETAIL,
    MEETING_REGENERATE_DETAIL,
)
from app.services.organization_context import get_default_organization_id
from tests.helpers.anthropic_mocks import mock_claude_minutes_api
from tests.test_meeting_records import SECRETARY_REQUIRED_DETAIL, _create_meeting_event


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def secretary_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    member = Member(
        full_name="Board Secretary",
        email="secretary@semo.edu",
        student_id="55443322",
        major="Administration",
        graduation_year=2028,
        hashed_password=hash_password("securepass123"),
        role=MemberRole.BOARD,
        status=MemberStatus.APPROVED,
        position=MemberPosition.SECRETARY,
        email_verified_at=datetime.now(UTC),
    )
    db_session.add(member)
    db_session.commit()
    return auth_header(client, email="secretary@semo.edu")

_NOTES = (
    "The treasurer will prepare an expense breakdown by November 26. "
    "The board discussed collecting member feedback."
)
_NOVEMBER_PAYLOAD = {
    "summary": "The board discussed an expense breakdown and member feedback.",
    "key_decisions": [
        {
            "text": "The board approved collecting member feedback.",
            "evidence": "the board discussed collecting member feedback",
        }
    ],
    "action_items": [
        {
            "task": "Prepare an expense breakdown",
            "owner": "Treasurer",
            "due": "2024-11-26",
            "evidence": "the treasurer will prepare an expense breakdown by November 26",
        }
    ],
}


def _draft_body(summary, *, version, decisions=None, items=None):
    return {
        "summary": summary,
        "key_decisions": decisions or [],
        "action_items": items or [],
        "base_draft_version": version,
    }


def test_november_2026_meeting_grounds_deadline_and_drops_discussion(
    client,
    db_session,
    secretary_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    event = db_session.get(Event, event_id)
    event.starts_at = datetime(2026, 11, 20, 18, 0, tzinfo=ZoneInfo("America/Chicago"))
    db_session.commit()

    with mock_claude_minutes_api(_NOVEMBER_PAYLOAD) as mock_client:
        response = client.post(
            f"/api/v1/events/{event_id}/meeting/summarize",
            json={"raw_notes": _NOTES},
            headers=secretary_headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] is None
    assert body["draft_key_decisions"] == []
    assert body["draft_action_items"] == [
        {
            "task": "Prepare an expense breakdown",
            "owner": "Treasurer",
            "due": "2026-11-26",
        }
    ]
    assert body["raw_notes"] == _NOTES
    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "November 20, 2026" in prompt
    assert "Meeting year: 2026" in prompt
    assert "America/Chicago" in prompt


def test_generate_publish_and_reread_preserve_notes_and_skip_tasks(
    client,
    db_session,
    secretary_headers,
    board_member_headers,
):
    with patch("app.services.meeting_service.notify_board_of_meeting_update") as notify:
        event_id = _create_meeting_event(client, secretary_headers)
        notes = client.put(
            f"/api/v1/events/{event_id}/meeting/notes",
            json={"raw_notes": "Original notes about the budget."},
            headers=secretary_headers,
        )
        assert notes.status_code == 200

        saved = client.put(
            f"/api/v1/events/{event_id}/meeting/draft",
            json=_draft_body(
                "The board reviewed the budget.",
                version=None,
                decisions=["Approved the printed budget."],
                items=[{"task": "Email the budget", "owner": "Treasurer", "due": None}],
            ),
            headers=secretary_headers,
        )
        assert saved.status_code == 200
        version = saved.json()["draft_version"]
        notify.assert_called_once()
        assert notify.call_args.kwargs["notification_kind"] == "notes"

        published = client.post(
            f"/api/v1/events/{event_id}/meeting/publish",
            json={"base_draft_version": version},
            headers=secretary_headers,
        )
        assert published.status_code == 200
        body = published.json()
        assert body["summary"] == "The board reviewed the budget."
        assert body["draft_version"] is None
        assert body["raw_notes"] == "Original notes about the budget."
        assert notify.call_count == 2
        assert notify.call_args.kwargs["notification_kind"] == "summary"

        again = client.post(
            f"/api/v1/events/{event_id}/meeting/publish",
            json={"base_draft_version": version},
            headers=secretary_headers,
        )
        assert again.status_code == 422
        assert notify.call_count == 2

        task_count = db_session.scalar(
            select(func.count()).select_from(EventTask).where(EventTask.event_id == event_id)
        )
        assert task_count == 0

        visible = client.get(
            f"/api/v1/events/{event_id}/meeting",
            headers=board_member_headers,
        )
        assert visible.status_code == 200
        assert visible.json()["minutes"]["summary"] == "The board reviewed the budget."


def test_replacement_draft_stays_hidden_until_publish(
    client,
    db_session,
    secretary_headers,
    board_member_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    created = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Official overview.", version=None),
        headers=secretary_headers,
    )
    published = client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": created.json()["draft_version"]},
        headers=secretary_headers,
    )
    assert published.status_code == 200

    with patch("app.services.meeting_service.notify_board_of_meeting_update") as notify:
        replacement = client.put(
            f"/api/v1/events/{event_id}/meeting/draft",
            json=_draft_body("Replacement overview.", version=None),
            headers=secretary_headers,
        )
        assert replacement.status_code == 200
        notify.assert_not_called()

        board = client.get(
            f"/api/v1/events/{event_id}/meeting",
            headers=board_member_headers,
        ).json()["minutes"]
        manager = client.get(
            f"/api/v1/events/{event_id}/meeting",
            headers=secretary_headers,
        ).json()["minutes"]

    assert board["summary"] == "Official overview."
    assert board["draft_version"] is None
    assert board["draft_summary"] is None
    assert manager["summary"] == "Official overview."
    assert manager["draft_summary"] == "Replacement overview."
    assert manager["raw_notes"] == ""

    listed = client.get("/api/v1/events/meetings", headers=board_member_headers)
    assert listed.status_code == 200
    assert "Replacement overview." not in listed.text

    from app.services.ai_chat_tools import execute_chat_tool
    from app.services.member_activity_service import get_member_activity

    board_member = db_session.query(Member).filter(Member.email == "board@semo.edu").one()
    secretary = db_session.query(Member).filter(Member.email == "secretary@semo.edu").one()
    for tool_name, tool_input in (
        ("list_upcoming_meetings", {}),
        ("get_event_details", {"event_id": event_id}),
    ):
        result = execute_chat_tool(
            db=db_session,
            member=board_member,
            tool_name=tool_name,
            tool_input=tool_input,
        )
        assert "Replacement overview." not in result
    activity = get_member_activity(
        db_session,
        member_id=secretary.id,
        viewer=board_member,
    )
    assert "Replacement overview." not in activity.model_dump_json()


def test_republishing_the_same_minutes_does_not_notify_again(
    client,
    secretary_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    with patch("app.services.meeting_service.notify_board_of_meeting_update") as notify:
        first = client.put(
            f"/api/v1/events/{event_id}/meeting/draft",
            json=_draft_body("Same overview.", version=None),
            headers=secretary_headers,
        )
        client.post(
            f"/api/v1/events/{event_id}/meeting/publish",
            json={"base_draft_version": first.json()["draft_version"]},
            headers=secretary_headers,
        )
        second = client.put(
            f"/api/v1/events/{event_id}/meeting/draft",
            json=_draft_body("Same overview.", version=None),
            headers=secretary_headers,
        )
        repeated = client.post(
            f"/api/v1/events/{event_id}/meeting/publish",
            json={"base_draft_version": second.json()["draft_version"]},
            headers=secretary_headers,
        )

    assert repeated.status_code == 200
    assert repeated.json()["summary"] == "Same overview."
    assert notify.call_count == 1
    assert "Same overview." not in str(notify.call_args)


def test_stale_draft_save_and_publish_do_not_overwrite(
    client,
    secretary_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    first = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("First draft.", version=None),
        headers=secretary_headers,
    )
    version = first.json()["draft_version"]
    second = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Second draft.", version=version),
        headers=secretary_headers,
    )
    assert second.status_code == 200

    stale = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Stale draft.", version=version),
        headers=secretary_headers,
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == MEETING_DRAFT_CONFLICT_DETAIL

    stale_publish = client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": version},
        headers=secretary_headers,
    )
    assert stale_publish.status_code == 409

    current = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=secretary_headers,
    ).json()["minutes"]
    assert current["draft_summary"] == "Second draft."
    assert current["summary"] is None


def test_regenerate_requires_confirmation_and_keeps_published_minutes(
    client,
    secretary_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    created = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Official overview.", version=None),
        headers=secretary_headers,
    )
    client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": created.json()["draft_version"]},
        headers=secretary_headers,
    )
    edited = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Edited replacement.", version=None),
        headers=secretary_headers,
    )
    version = edited.json()["draft_version"]

    with patch("app.services.meeting_service.notify_board_of_meeting_update") as notify:
        rejected = client.post(
            f"/api/v1/events/{event_id}/meeting/summarize",
            json={"raw_notes": "Approved the room rental.", "base_draft_version": version},
            headers=secretary_headers,
        )
        assert rejected.status_code == 409
        assert rejected.json()["detail"] == MEETING_REGENERATE_DETAIL

        with mock_claude_minutes_api(
            {
                "summary": "The board approved the room rental.",
                "key_decisions": [
                    {
                        "text": "Approved the room rental.",
                        "evidence": "Approved the room rental",
                    }
                ],
                "action_items": [],
            }
        ):
            regenerated = client.post(
                f"/api/v1/events/{event_id}/meeting/summarize",
                json={
                    "raw_notes": "Approved the room rental.",
                    "confirm_regenerate": True,
                    "base_draft_version": version,
                },
                headers=secretary_headers,
            )

    assert regenerated.status_code == 200
    body = regenerated.json()
    assert body["summary"] == "Official overview."
    assert body["draft_summary"] == "The board approved the room rental."
    assert body["raw_notes"] == "Approved the room rental."
    notify.assert_not_called()


def test_board_member_cannot_publish_minutes(client, board_member_headers, secretary_headers):
    event_id = _create_meeting_event(client, secretary_headers)
    response = client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": 1},
        headers=board_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == SECRETARY_REQUIRED_DETAIL


def test_other_organization_cannot_read_or_publish_minutes(
    client,
    db_session,
    secretary_headers,
):
    event_id = _create_meeting_event(client, secretary_headers)
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter-minutes",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    stored = db_session.get(Event, event_id)
    stored.organization_id = other.id
    db_session.commit()

    detail = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=secretary_headers,
    )
    publish = client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": 1},
        headers=secretary_headers,
    )
    listed = client.get("/api/v1/events/meetings", headers=secretary_headers)

    assert detail.status_code == 404
    assert publish.status_code == 404
    assert all(meeting["event_id"] != event_id for meeting in listed.json()["meetings"])


def test_stale_generation_does_not_overwrite_a_newer_draft(client, secretary_headers):
    event_id = _create_meeting_event(client, secretary_headers)
    first = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("First private draft.", version=None),
        headers=secretary_headers,
    )
    version = first.json()["draft_version"]
    newer = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Newer private draft.", version=version),
        headers=secretary_headers,
    )
    assert newer.status_code == 200

    with mock_claude_minutes_api(
        {
            "summary": "The board approved a replacement.",
            "key_decisions": [],
            "action_items": [],
        }
    ) as mock_client:
        stale = client.post(
            f"/api/v1/events/{event_id}/meeting/summarize",
            json={
                "raw_notes": "The board approved a replacement.",
                "confirm_regenerate": True,
                "base_draft_version": version,
            },
            headers=secretary_headers,
        )

    assert stale.status_code == 409
    assert stale.json()["detail"] == MEETING_DRAFT_CONFLICT_DETAIL
    mock_client.messages.create.assert_not_called()
    current = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=secretary_headers,
    ).json()["minutes"]
    assert current["draft_summary"] == "Newer private draft."
    assert current["summary"] is None
    assert current["raw_notes"] == ""


def test_notification_failure_keeps_the_published_record(client, secretary_headers):
    event_id = _create_meeting_event(client, secretary_headers)
    notes = client.put(
        f"/api/v1/events/{event_id}/meeting/notes",
        json={"raw_notes": "Original treasurer notes."},
        headers=secretary_headers,
    )
    assert notes.status_code == 200
    draft = client.put(
        f"/api/v1/events/{event_id}/meeting/draft",
        json=_draft_body("Reviewed overview.", version=None),
        headers=secretary_headers,
    )
    with patch(
        "app.services.meeting_service.notify_board_of_meeting_update",
        side_effect=RuntimeError("resend down"),
    ):
        with pytest.raises(RuntimeError, match="resend down"):
            client.post(
                f"/api/v1/events/{event_id}/meeting/publish",
                json={"base_draft_version": draft.json()["draft_version"]},
                headers=secretary_headers,
            )

    minutes = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=secretary_headers,
    ).json()["minutes"]
    assert minutes["summary"] == "Reviewed overview."
    assert minutes["draft_version"] is None
    assert minutes["raw_notes"] == "Original treasurer notes."
    repeated = client.post(
        f"/api/v1/events/{event_id}/meeting/publish",
        json={"base_draft_version": draft.json()["draft_version"]},
        headers=secretary_headers,
    )
    assert repeated.status_code == 422
