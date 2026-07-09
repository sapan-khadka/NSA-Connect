from unittest.mock import patch

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

BOARD_REQUIRED_DETAIL = "Requires board role or higher"
SECRETARY_REQUIRED_DETAIL = "Requires secretary, vice president, or president"


def _future_starts_at() -> str:
    return "2030-06-01T18:00:00+00:00"


def _meeting_payload(**overrides):
    payload = {
        "name": "March Board Meeting",
        "starts_at": _future_starts_at(),
        "event_type": "meeting",
        "description": "Monthly board meeting.",
        "budget": "0.00",
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
def secretary_headers(client, db_session):
    from app.core.security import hash_password
    from app.models.member import Member, MemberPosition, MemberRole, MemberStatus

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
    )
    db_session.add(member)
    db_session.commit()
    return auth_header(client, email="secretary@semo.edu")


def _create_meeting_event(client, headers):
    response = client.post(
        "/api/v1/events",
        json=_meeting_payload(),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_board_member_can_view_meeting_record(client, board_member_headers):
    event_id = _create_meeting_event(client, board_member_headers)

    response = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["event_name"] == "March Board Meeting"
    assert body["can_manage"] is False
    assert len(body["attendance"]) == 1
    assert body["attendance"][0]["full_name"] == "Board Member"
    assert body["attendance"][0]["status"] is None
    assert body["minutes"]["raw_notes"] == ""


def test_meeting_records_are_not_available_for_non_meeting_events(
    client,
    board_member_headers,
):
    response = client.post(
        "/api/v1/events",
        json={
            "name": "Dashain Celebration",
            "starts_at": _future_starts_at(),
            "event_type": "cultural",
            "description": "Cultural night.",
            "budget": "250.00",
        },
        headers=board_member_headers,
    )
    event_id = response.json()["id"]

    response = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=board_member_headers,
    )

    assert response.status_code == 422
    assert "meeting events" in response.json()["detail"]


def test_general_member_cannot_view_meeting_records(
    client,
    board_member_headers,
    general_member_headers,
):
    event_id = _create_meeting_event(client, board_member_headers)

    response = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_secretary_can_save_notes_and_attendance(client, secretary_headers):
    event_id = _create_meeting_event(client, secretary_headers)

    notes_response = client.put(
        f"/api/v1/events/{event_id}/meeting/notes",
        json={"raw_notes": "Approved Dashain budget.\nTreasurer to send report."},
        headers=secretary_headers,
    )
    assert notes_response.status_code == 200
    assert "Approved Dashain budget" in notes_response.json()["raw_notes"]

    detail_response = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=secretary_headers,
    )
    member_id = detail_response.json()["attendance"][0]["member_id"]

    attendance_response = client.put(
        f"/api/v1/events/{event_id}/meeting/attendance",
        json={"entries": [{"member_id": member_id, "status": "present"}]},
        headers=secretary_headers,
    )
    assert attendance_response.status_code == 200
    body = attendance_response.json()
    assert body["present_count"] == 1
    assert body["attendance"][0]["status"] == "present"


def test_board_member_without_secretary_role_cannot_edit_meeting_records(
    client,
    board_member_headers,
):
    event_id = _create_meeting_event(client, board_member_headers)

    response = client.put(
        f"/api/v1/events/{event_id}/meeting/notes",
        json={"raw_notes": "notes"},
        headers=board_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == SECRETARY_REQUIRED_DETAIL


def test_secretary_can_summarize_and_store_meeting_minutes(
    client,
    secretary_headers,
    mock_claude_minutes_api,
):
    with patch(
        "app.services.meeting_service.notify_board_of_meeting_update",
    ) as mock_notify:
        event_id = _create_meeting_event(client, secretary_headers)

        response = client.post(
            f"/api/v1/events/{event_id}/meeting/summarize",
            json={"raw_notes": "approved dashain date\nreserve room"},
            headers=secretary_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["summary"]
        assert body["raw_notes"] == "approved dashain date\nreserve room"
        mock_notify.assert_called_once()
        assert mock_notify.call_args.kwargs["notification_kind"] == "summary"


def test_board_member_can_list_meeting_history(client, board_member_headers):
    event_id = _create_meeting_event(client, board_member_headers)

    list_response = client.get("/api/v1/events/meetings", headers=board_member_headers)
    assert list_response.status_code == 200
    body = list_response.json()
    assert body["total"] == 1
    meeting = body["meetings"][0]
    assert meeting["event_id"] == event_id
    assert meeting["event_name"] == "March Board Meeting"
    assert meeting["has_attendance"] is False
    assert meeting["has_minutes"] is False

    detail_response = client.get(
        f"/api/v1/events/{event_id}/meeting",
        headers=board_member_headers,
    )
    assert detail_response.json()["agenda"] == "Monthly board meeting."


def test_list_meetings_reflects_saved_records(
    client, secretary_headers, board_member_headers
):
    with patch(
        "app.services.meeting_service.notify_board_of_meeting_update",
    ) as mock_notify:
        event_id = _create_meeting_event(client, secretary_headers)

        client.put(
            f"/api/v1/events/{event_id}/meeting/notes",
            json={"raw_notes": "Discussed budget and Dashain planning."},
            headers=secretary_headers,
        )

        assert mock_notify.call_count == 1
        assert mock_notify.call_args.kwargs["notification_kind"] == "notes"

        detail = client.get(
            f"/api/v1/events/{event_id}/meeting",
            headers=secretary_headers,
        ).json()
        member_id = detail["attendance"][0]["member_id"]

        client.put(
            f"/api/v1/events/{event_id}/meeting/attendance",
            json={"entries": [{"member_id": member_id, "status": "present"}]},
            headers=secretary_headers,
        )

        assert mock_notify.call_count == 2
        assert mock_notify.call_args.kwargs["notification_kind"] == "attendance"

        meeting = client.get(
            "/api/v1/events/meetings", headers=board_member_headers
        ).json()["meetings"][0]
        assert meeting["has_attendance"] is True
        assert meeting["has_minutes"] is True
        assert meeting["present_count"] == 1
