from datetime import UTC, datetime
from decimal import Decimal

from conftest import create_board_member
from sqlalchemy import select

from app.models.event import Event, EventType, MeetingVisibility
from app.models.meeting import MeetingRecord
from app.models.member import Member, MemberRole, MemberStatus
from app.models.organization import Organization, OrganizationStatus
from app.services.ai_chat_tools import execute_chat_tool
from app.services.organization_context import get_default_organization_id


def _board(db_session) -> Member:
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    if member is None:
        member = create_board_member(db_session)
    return member


def _general(db_session) -> Member:
    member = Member(
        full_name="General Member",
        email="general-minutes@semo.edu",
        student_id="11111111",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _meeting(
    db_session,
    member: Member,
    *,
    title: str,
    starts_at: datetime,
    summary: str | None,
    published_at: datetime | None,
    visibility: MeetingVisibility = MeetingVisibility.BOARD_ONLY,
    organization_id: int | None = None,
    decisions: list[str] | None = None,
    action_items: list[dict] | None = None,
    raw_notes: str = "SECRET RAW NOTES",
    draft_summary: str | None = None,
) -> Event:
    event = Event(
        title=title,
        description="Agenda that is not the minutes",
        event_type=EventType.MEETING,
        starts_at=starts_at,
        budget=Decimal("0.00"),
        meeting_visibility=visibility,
        created_by_id=member.id,
        organization_id=organization_id or get_default_organization_id(db_session),
    )
    db_session.add(event)
    db_session.flush()
    db_session.add(
        MeetingRecord(
            event_id=event.id,
            raw_notes=raw_notes,
            summary=summary,
            key_decisions=decisions or [],
            action_items=action_items or [],
            draft_summary=draft_summary,
            draft_key_decisions=["UNPUBLISHED REPLACEMENT DRAFT"] if draft_summary else None,
            draft_action_items=(
                [{"task": "Leak the draft", "owner": "Nobody", "due": "tomorrow"}]
                if draft_summary
                else None
            ),
            draft_version=2 if draft_summary else None,
            published_at=published_at,
        )
    )
    db_session.commit()
    db_session.refresh(event)
    return event


def _minutes(db_session, member: Member, **tool_input: object) -> str:
    return execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_published_meeting_minutes",
        tool_input=tool_input,
    )


def test_published_minutes_include_future_meetings_and_stored_deadlines(db_session):
    member = _board(db_session)
    older = _meeting(
        db_session,
        member,
        title="October Board Meeting",
        starts_at=datetime(2026, 10, 16, 0, 0, tzinfo=UTC),
        summary="Older official overview.",
        published_at=datetime(2026, 10, 16, 18, 0, tzinfo=UTC),
        decisions=["Approved the room."],
    )
    future = _meeting(
        db_session,
        member,
        title="March Planning Meeting",
        starts_at=datetime(2027, 3, 7, 0, 0, tzinfo=UTC),
        summary="Official March overview.",
        published_at=datetime(2026, 11, 20, 18, 0, tzinfo=UTC),
        decisions=["Approved a $350 food budget."],
        action_items=[
            {"task": "Prepare the expense breakdown", "owner": "Treasurer", "due": "2026-11-26"},
            {"task": "Keep the written deadline", "owner": "Secretary", "due": "November 26"},
        ],
        draft_summary="UNPUBLISHED REPLACEMENT DRAFT",
        raw_notes="SECRET RAW NOTES about the draft",
    )

    latest = _minutes(db_session, member, limit=1)
    assert f'"event_id": {future.id}' in latest
    assert f'"event_id": {older.id}' not in latest

    result = _minutes(db_session, member, event_id=future.id, query="October")
    assert "Official March overview." in result
    assert "Approved a $350 food budget." in result
    assert "Prepare the expense breakdown" in result
    assert "Treasurer" in result
    assert '"due": "2026-11-26"' in result
    assert '"due": "November 26"' in result
    assert "Saturday, March 6, 2027 at 6:00 PM CST" in result
    assert "Friday, November 20, 2026 at 12:00 PM CST" in result
    assert "March 7, 2027" not in result
    assert "Older official overview." not in result
    assert "SECRET RAW NOTES" not in result
    assert "UNPUBLISHED REPLACEMENT DRAFT" not in result
    assert "Leak the draft" not in result
    assert "untrusted" in result

    found = _minutes(db_session, member, query="food budget")
    assert "Official March overview." in found
    assert "Older official overview." not in found


def test_unpublished_meetings_are_excluded(db_session):
    member = _board(db_session)
    hidden = _meeting(
        db_session,
        member,
        title="Unpublished Meeting",
        starts_at=datetime(2026, 11, 20, 0, 0, tzinfo=UTC),
        summary="Draft was never published.",
        published_at=None,
        draft_summary="UNPUBLISHED REPLACEMENT DRAFT",
    )

    by_id = _minutes(db_session, member, event_id=hidden.id)
    by_query = _minutes(db_session, member, query="Unpublished")
    assert "not_found" in by_id
    assert "Draft was never published." not in by_id
    assert "UNPUBLISHED REPLACEMENT DRAFT" not in by_id
    assert "SECRET RAW NOTES" not in by_id
    assert "Draft was never published." not in by_query
    assert '"meetings": []' in by_query


def test_general_member_cannot_read_minutes(db_session):
    board = _board(db_session)
    general = _general(db_session)
    public = _meeting(
        db_session,
        board,
        title="Public Schedule Meeting",
        starts_at=datetime(2026, 11, 21, 0, 0, tzinfo=UTC),
        summary="PUBLIC OVERVIEW SHOULD STAY HIDDEN",
        published_at=datetime(2026, 11, 21, 18, 0, tzinfo=UTC),
        visibility=MeetingVisibility.PUBLIC,
    )
    restricted = _meeting(
        db_session,
        board,
        title="Closed Board Meeting",
        starts_at=datetime(2026, 11, 22, 0, 0, tzinfo=UTC),
        summary="RESTRICTED OVERVIEW SHOULD STAY HIDDEN",
        published_at=datetime(2026, 11, 22, 18, 0, tzinfo=UTC),
        visibility=MeetingVisibility.BOARD_ONLY,
    )

    for event, phrase in (
        (public, "PUBLIC OVERVIEW SHOULD STAY HIDDEN"),
        (restricted, "RESTRICTED OVERVIEW SHOULD STAY HIDDEN"),
    ):
        by_id = _minutes(db_session, general, event_id=event.id, query=event.title)
        by_query = _minutes(db_session, general, query=phrase)
        assert "permission_denied" in by_id
        assert "permission_denied" in by_query
        assert phrase not in by_id
        assert phrase not in by_query

    visible = _minutes(db_session, board, event_id=restricted.id)
    assert "RESTRICTED OVERVIEW SHOULD STAY HIDDEN" in visible


def test_other_organization_minutes_are_not_returned(db_session):
    member = _board(db_session)
    local = _meeting(
        db_session,
        member,
        title="Local Budget Meeting",
        starts_at=datetime(2026, 11, 18, 0, 0, tzinfo=UTC),
        summary="LOCAL OFFICIAL OVERVIEW",
        published_at=datetime(2026, 11, 18, 18, 0, tzinfo=UTC),
    )
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter-assistant",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    foreign = _meeting(
        db_session,
        member,
        title="Other Budget Meeting",
        starts_at=datetime(2026, 11, 19, 0, 0, tzinfo=UTC),
        summary="FOREIGN OFFICIAL OVERVIEW",
        published_at=datetime(2026, 11, 19, 18, 0, tzinfo=UTC),
        organization_id=other.id,
    )

    by_id = _minutes(
        db_session,
        member,
        event_id=foreign.id,
        query="Local Budget",
        include_notes=True,
    )
    by_title = _minutes(db_session, member, query="Other Budget")
    assert "not_found" in by_id
    assert "FOREIGN OFFICIAL OVERVIEW" not in by_id
    assert "LOCAL OFFICIAL OVERVIEW" not in by_id
    assert "SECRET RAW NOTES" not in by_id
    assert "FOREIGN OFFICIAL OVERVIEW" not in by_title
    assert f'"event_id": {local.id}' in _minutes(db_session, member, query="Local Budget")


def test_recent_minutes_results_say_when_the_archive_was_not_fully_searched(db_session):
    member = _board(db_session)
    hidden_tail = "UNIQUE-TAIL-DECISION"
    long_meeting = _meeting(
        db_session,
        member,
        title="Long Decision Meeting",
        starts_at=datetime(2026, 9, 1, 0, 0, tzinfo=UTC),
        summary="Long official overview.",
        published_at=datetime(2026, 9, 1, 18, 0, tzinfo=UTC),
        decisions=[f"Decision {index}" for index in range(20)] + [hidden_tail],
    )
    matched = _minutes(db_session, member, query=hidden_tail, limit=1)
    assert f'"event_id": {long_meeting.id}' in matched
    assert hidden_tail not in matched
    assert '"truncated": true' in matched

    for index in range(4):
        _meeting(
            db_session,
            member,
            title=f"Budget Window {index}",
            starts_at=datetime(2026, 8, index + 1, 0, 0, tzinfo=UTC),
            summary=f"Window overview {index}",
            published_at=datetime(2026, 8, index + 1, 18, 0, tzinfo=UTC),
        )
    window = _minutes(db_session, member, query="Window overview", limit=1)
    assert '"additional_matches_omitted": true' in window
    assert "not a complete historical archive" in window
    assert window.count("Window overview") == 1

    for index in range(31):
        _meeting(
            db_session,
            member,
            title=f"Archive {index}",
            starts_at=datetime(2025, 1, 1, 0, 0, tzinfo=UTC),
            summary="Recent archive overview" if index else "OLDEST ARCHIVE OVERVIEW",
            published_at=(
                datetime(2025, 1, 1, tzinfo=UTC)
                if index == 0
                else datetime(2026, 1, index, tzinfo=UTC)
            ),
        )
    oldest = _minutes(db_session, member, query="OLDEST ARCHIVE OVERVIEW")
    assert "OLDEST ARCHIVE OVERVIEW" not in oldest
    assert '"older_published_meetings_not_searched": true' in oldest
    assert '"meetings": []' in oldest
