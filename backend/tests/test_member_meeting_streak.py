from datetime import UTC, datetime, timedelta

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event, EventType, MeetingVisibility
from app.models.meeting import MeetingAttendance, MeetingAttendanceStatus
from app.models.member import Member


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session)


@pytest.fixture
def board_headers(client, board_member):
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def general_member(client, db_session):
    register_member(client, email="general@semo.edu", student_id="11111111")
    set_member_approved(db_session, email="general@semo.edu")
    return db_session.scalar(select(Member).where(Member.email == "general@semo.edu"))


@pytest.fixture
def general_headers(client, general_member):
    return auth_header(client, email="general@semo.edu")


def _add_past_meeting(
    db_session,
    *,
    days_ago: int,
    title: str,
    created_by_id: int,
) -> Event:
    event = Event(
        title=title,
        description="Board meeting",
        location="Campus",
        starts_at=datetime.now(UTC) - timedelta(days=days_ago),
        event_type=EventType.MEETING,
        meeting_visibility=MeetingVisibility.BOARD_ONLY,
        budget=0,
        created_by_id=created_by_id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def _mark(
    db_session,
    *,
    event_id: int,
    member_id: int,
    status: MeetingAttendanceStatus,
) -> None:
    db_session.add(
        MeetingAttendance(
            event_id=event_id,
            member_id=member_id,
            status=status,
        ),
    )
    db_session.commit()


def test_streak_counts_trailing_absents_and_breaks_on_present(
    client,
    db_session,
    board_member,
    board_headers,
):
    oldest = _add_past_meeting(
        db_session,
        days_ago=30,
        title="Meeting A",
        created_by_id=board_member.id,
    )
    mid = _add_past_meeting(
        db_session,
        days_ago=20,
        title="Meeting B",
        created_by_id=board_member.id,
    )
    newest = _add_past_meeting(
        db_session,
        days_ago=10,
        title="Meeting C",
        created_by_id=board_member.id,
    )
    _mark(
        db_session,
        event_id=oldest.id,
        member_id=board_member.id,
        status=MeetingAttendanceStatus.ABSENT,
    )
    _mark(
        db_session,
        event_id=mid.id,
        member_id=board_member.id,
        status=MeetingAttendanceStatus.ABSENT,
    )
    _mark(
        db_session,
        event_id=newest.id,
        member_id=board_member.id,
        status=MeetingAttendanceStatus.ABSENT,
    )

    response = client.get(
        f"/api/v1/members/{board_member.id}/meeting-attendance-streak",
        headers=board_headers,
    )
    assert response.status_code == 200
    assert response.json()["consecutive_missed_meetings"] == 3

    # Present on newest breaks trailing streak (only older absents remain behind).
    newest_row = db_session.scalar(
        select(MeetingAttendance).where(
            MeetingAttendance.event_id == newest.id,
            MeetingAttendance.member_id == board_member.id,
        ),
    )
    newest_row.status = MeetingAttendanceStatus.PRESENT
    db_session.commit()

    response = client.get(
        f"/api/v1/members/{board_member.id}/meeting-attendance-streak",
        headers=board_headers,
    )
    assert response.status_code == 200
    assert response.json()["consecutive_missed_meetings"] == 0


def test_general_cannot_view_others_streak(
    client,
    board_member,
    general_headers,
):
    response = client.get(
        f"/api/v1/members/{board_member.id}/meeting-attendance-streak",
        headers=general_headers,
    )
    assert response.status_code == 403


def test_member_can_view_own_zero_streak(
    client,
    general_member,
    general_headers,
):
    response = client.get(
        f"/api/v1/members/{general_member.id}/meeting-attendance-streak",
        headers=general_headers,
    )
    assert response.status_code == 200
    assert response.json()["consecutive_missed_meetings"] == 0
