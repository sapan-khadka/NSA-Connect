from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from app.services.meeting_notification_service import (
    build_meeting_detail_url,
    notify_board_of_meeting_update,
)
from app.tasks.email_tasks import send_meeting_record_notification_email_task


@pytest.fixture
def secretary_and_board(db_session):
    from app.core.security import hash_password
    from app.models.member import Member, MemberPosition, MemberRole, MemberStatus

    board = Member(
        full_name="Board Member",
        email="board@semo.edu",
        student_id="87654321",
        major="Administration",
        graduation_year=2028,
        hashed_password=hash_password("securepass123"),
        role=MemberRole.BOARD,
        status=MemberStatus.APPROVED,
        position=MemberPosition.MEMBER,
    )
    secretary = Member(
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
    db_session.add_all([board, secretary])
    db_session.commit()
    db_session.refresh(board)
    db_session.refresh(secretary)
    return board, secretary


def test_build_meeting_detail_url_uses_frontend_base():
    with patch("app.services.meeting_notification_service.settings") as mock_settings:
        mock_settings.FRONTEND_URL = "https://connect.example.edu/"
        assert (
            build_meeting_detail_url(42)
            == "https://connect.example.edu/events/meetings/42"
        )


@patch("app.tasks.email_tasks.send_meeting_record_notification_email_task")
def test_notify_board_of_meeting_update_queues_other_board_members(
    mock_task,
    db_session,
    secretary_and_board,
):
    from app.models.event import Event, EventType

    board, secretary = secretary_and_board
    event = Event(
        title="March Board Meeting",
        description="Budget review",
        event_type=EventType.MEETING,
        starts_at=datetime(2030, 5, 1, 18, 0, tzinfo=UTC),
        budget="0.00",
        created_by_id=secretary.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    queued = notify_board_of_meeting_update(
        db_session,
        event_id=event.id,
        updated_by=secretary,
        notification_kind="summary",
    )

    assert queued == 1
    mock_task.delay.assert_called_once()
    assert mock_task.delay.call_args.kwargs["email"] == board.email
    assert mock_task.delay.call_args.kwargs["notification_kind"] == "summary"
    assert mock_task.delay.call_args.kwargs["meeting_url"].endswith(
        f"/events/meetings/{event.id}",
    )


@patch("app.tasks.email_tasks.send_meeting_record_notification_email")
def test_send_meeting_record_notification_email_task_sends_email(mock_send):
    meeting_starts_at = datetime(2030, 5, 1, 18, 0, tzinfo=UTC)

    send_meeting_record_notification_email_task(
        email="board@semo.edu",
        full_name="Board Member",
        meeting_title="March Board Meeting",
        notification_kind="summary",
        recorded_by_name="Board Secretary",
        meeting_starts_at_iso=meeting_starts_at.isoformat(),
        meeting_url="http://localhost:5173/events/meetings/3",
    )

    mock_send.assert_called_once_with(
        email="board@semo.edu",
        full_name="Board Member",
        meeting_title="March Board Meeting",
        notification_kind="summary",
        recorded_by_name="Board Secretary",
        meeting_starts_at=meeting_starts_at,
        meeting_url="http://localhost:5173/events/meetings/3",
    )
