import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from conftest import create_board_member
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.event_task import EventTask, EventTaskStatus
from app.models.member import Member
from app.services.ai_chat_tools import _json_default, execute_chat_tool
from app.services.organization_context import get_default_organization_id


def _board(db_session) -> Member:
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    if member is None:
        member = create_board_member(db_session)
    return member


def _event(
    db_session,
    member: Member,
    *,
    title: str,
    starts_at: datetime,
    ends_at: datetime | None = None,
) -> Event:
    event = Event(
        title=title,
        description="Schedule check",
        event_type=EventType.CULTURAL,
        starts_at=starts_at,
        ends_at=ends_at,
        budget=Decimal("0.00"),
        created_by_id=member.id,
        organization_id=get_default_organization_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def _details(db_session, member: Member, event_id: int) -> str:
    return execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_event_details",
        tool_input={"event_id": event_id},
    )


def test_utc_midnight_and_march_evening_use_central_time(db_session):
    member = _board(db_session)
    cultural = _event(
        db_session,
        member,
        title="Nepali Cultural Night",
        starts_at=datetime(2026, 11, 28, 0, 0, tzinfo=UTC),
        ends_at=datetime(2026, 11, 28, 6, 0, tzinfo=UTC),
    )
    carpe = _event(
        db_session,
        member,
        title="Carpe Diem",
        starts_at=datetime(2027, 3, 7, 0, 0, tzinfo=UTC),
    )
    year_end = _event(
        db_session,
        member,
        title="Year Boundary Social",
        starts_at=datetime(2027, 1, 1, 0, 0, tzinfo=UTC),
    )

    cultural_result = _details(db_session, member, cultural.id)
    assert "Friday, November 27, 2026 at 6:00 PM CST" in cultural_result
    assert "Saturday, November 28, 2026 at 12:00 AM CST" in cultural_result
    assert "2026-11-28T00:00:00" not in cultural_result

    carpe_result = _details(db_session, member, carpe.id)
    assert "Saturday, March 6, 2027 at 6:00 PM CST" in carpe_result
    assert "March 7, 2027" not in carpe_result

    year_result = _details(db_session, member, year_end.id)
    assert "Thursday, December 31, 2026 at 6:00 PM CST" in year_result
    assert "January 1, 2027" not in year_result


def test_daylight_saving_deadline_and_overdue_use_the_stored_instant(db_session):
    member = _board(db_session)
    event = _event(
        db_session,
        member,
        title="Summer Picnic",
        starts_at=datetime(2026, 7, 15, 0, 0, tzinfo=UTC),
    )
    upcoming_due = datetime.now(UTC) + timedelta(hours=2)
    overdue_due = datetime(2026, 3, 7, 0, 0, tzinfo=UTC)
    summer_due = datetime(2026, 7, 15, 0, 0, tzinfo=UTC)
    db_session.add_all(
        [
            EventTask(
                event_id=event.id,
                title="Missing deadline",
                description="",
                status=EventTaskStatus.TODO,
                due_date=None,
            ),
            EventTask(
                event_id=event.id,
                title="Still open",
                description="",
                status=EventTaskStatus.TODO,
                due_date=upcoming_due,
            ),
            EventTask(
                event_id=event.id,
                title="March follow-up",
                description="",
                status=EventTaskStatus.TODO,
                due_date=overdue_due,
            ),
            EventTask(
                event_id=event.id,
                title="Summer setup",
                description="",
                status=EventTaskStatus.IN_PROGRESS,
                due_date=summer_due,
            ),
        ]
    )
    db_session.commit()

    details = _details(db_session, member, event.id)
    assert "Tuesday, July 14, 2026 at 7:00 PM CDT" in details

    result = execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="list_open_tasks",
        tool_input={"limit": 20},
    )
    tasks = {task["title"]: task for task in json.loads(result)}
    assert tasks["Missing deadline"]["due_date"] is None
    assert tasks["Missing deadline"]["is_overdue"] is False
    assert tasks["Still open"]["is_overdue"] is False
    assert tasks["March follow-up"]["due_date"] == (
        "Friday, March 6, 2026 at 6:00 PM CST"
    )
    assert tasks["March follow-up"]["is_overdue"] is True
    assert tasks["Summer setup"]["due_date"] == (
        "Tuesday, July 14, 2026 at 7:00 PM CDT"
    )
    assert tasks["Summer setup"]["is_overdue"] is True
    assert "2026-03-07T00:00:00" not in result


def test_generic_datetime_serialization_stays_utc(db_session):
    del db_session
    stamp = datetime(2026, 11, 28, 0, 0, tzinfo=UTC)
    assert _json_default(stamp) == "2026-11-28T00:00:00+00:00"
