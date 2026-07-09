from datetime import UTC, datetime, timedelta

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.event_checkin import EventCheckIn
from app.models.event_guest_checkin import EventGuestCheckIn
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member
from app.services.event_checkin_service import (
    CheckInWindowClosedError,
    InvalidCheckInTokenError,
    ensure_checkin_token,
    perform_checkin,
)


def _create_event(db, *, starts_at: datetime, creator_id: int) -> Event:
    event = Event(
        title="Spring Social",
        description="Test event",
        event_type=EventType.SOCIAL,
        location="Student Center",
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=2),
        budget=0,
        created_by_id=creator_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@pytest.fixture
def board_member(db_session):
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    if member is not None:
        return member
    return create_board_member(db_session)


@pytest.fixture
def member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_board_can_fetch_checkin_qr(client, board_headers, db_session, board_member):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )

    response = client.get(
        f"/api/v1/events/{event.id}/checkin/qr",
        headers=board_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["event_id"] == event.id
    assert "token=" in body["checkin_url"]
    assert len(body["token"]) >= 32


def test_checkin_records_attendance_once(
    client, member_headers, db_session, board_member
):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    first = client.post(
        f"/api/v1/events/{event.id}/checkin",
        headers=member_headers,
        json={"token": token},
    )
    second = client.post(
        f"/api/v1/events/{event.id}/checkin",
        headers=member_headers,
        json={"token": token},
    )

    assert first.status_code == 200
    assert first.json()["status"] == "checked_in"
    assert second.status_code == 200
    assert second.json()["status"] == "already_checked_in"

    rows = db_session.scalars(
        select(EventCheckIn).where(EventCheckIn.event_id == event.id)
    ).all()
    assert len(rows) == 1


def test_checkin_rejects_invalid_token(
    client, member_headers, db_session, board_member
):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )
    ensure_checkin_token(db_session, event)

    response = client.post(
        f"/api/v1/events/{event.id}/checkin",
        headers=member_headers,
        json={"token": "bad-token"},
    )

    assert response.status_code == 400
    assert "no longer valid" in response.json()["detail"]


def test_checkin_rejects_outside_window(db_session, board_member):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)
    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))

    with pytest.raises(CheckInWindowClosedError):
        perform_checkin(
            db_session,
            event_id=event.id,
            member_id=member.id,
            token=token,
            as_of=datetime(2030, 5, 30, 12, 0, tzinfo=UTC),
        )


def test_regenerate_token_invalidates_old_token(
    client, board_headers, db_session, board_member
):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )
    old = client.get(
        f"/api/v1/events/{event.id}/checkin/qr", headers=board_headers
    ).json()["token"]
    new = client.post(
        f"/api/v1/events/{event.id}/checkin/regenerate",
        headers=board_headers,
    ).json()["token"]

    assert old != new

    member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    with pytest.raises(InvalidCheckInTokenError):
        perform_checkin(
            db_session,
            event_id=event.id,
            member_id=member.id,
            token=old,
            as_of=datetime(2030, 6, 1, 17, 30, tzinfo=UTC),
        )


def test_attendance_summary_buckets(client, board_headers, db_session, board_member):
    event = _create_event(
        db_session,
        starts_at=datetime(2029, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )

    register_member(client, email="going@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="going@semo.edu")
    going_member = db_session.scalar(
        select(Member).where(Member.email == "going@semo.edu")
    )

    register_member(client, email="noshow@semo.edu", student_id="44444444")
    set_member_approved(db_session, email="noshow@semo.edu")
    noshow_member = db_session.scalar(
        select(Member).where(Member.email == "noshow@semo.edu")
    )

    register_member(client, email="walkin@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="walkin@semo.edu")
    walkin_member = db_session.scalar(
        select(Member).where(Member.email == "walkin@semo.edu")
    )

    now = datetime(2029, 6, 1, 18, 30, tzinfo=UTC)
    db_session.add_all(
        [
            EventRsvp(
                event_id=event.id,
                member_id=going_member.id,
                status=RsvpStatus.GOING,
                created_at=now,
                updated_at=now,
            ),
            EventRsvp(
                event_id=event.id,
                member_id=noshow_member.id,
                status=RsvpStatus.GOING,
                created_at=now,
                updated_at=now,
            ),
            EventRsvp(
                event_id=event.id,
                member_id=board_member.id,
                status=RsvpStatus.NOT_GOING,
                created_at=now,
                updated_at=now,
            ),
            EventCheckIn(
                event_id=event.id,
                member_id=going_member.id,
                checked_in_at=now,
            ),
            EventCheckIn(
                event_id=event.id,
                member_id=walkin_member.id,
                checked_in_at=now,
            ),
        ],
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/events/{event.id}/attendance-summary",
        headers=board_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["going_attended"]["count"] == 1
    assert body["going_no_show"]["count"] == 1
    assert body["walk_ins"]["count"] == 1
    assert body["not_going"]["count"] == 1
    assert body["guests_checked_in"]["count"] == 0


def test_guest_checkin_without_auth(client, db_session, board_member):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    response = client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={"token": token, "guest_name": "Dr. Smith"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "checked_in"
    assert body["guest_name"] == "Dr. Smith"

    rows = db_session.scalars(
        select(EventGuestCheckIn).where(EventGuestCheckIn.event_id == event.id),
    ).all()
    assert len(rows) == 1
    assert rows[0].guest_name == "Dr. Smith"
    assert rows[0].affiliation_type is None


def test_guest_checkin_name_only_optional_affiliation(client, db_session, board_member):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    response = client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={
            "token": token,
            "guest_name": "Campus Visitor",
        },
    )

    assert response.status_code == 200


def test_guest_checkin_with_affiliation(client, db_session, board_member):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    response = client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={
            "token": token,
            "guest_name": "Jane Faculty",
            "affiliation_type": "faculty_staff",
        },
    )

    assert response.status_code == 200


def test_guest_checkin_rejects_invalid_token(client, db_session, board_member):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )
    ensure_checkin_token(db_session, event)

    response = client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={"token": "bad-token", "guest_name": "Guest"},
    )

    assert response.status_code == 400


def test_guest_checkin_rejects_outside_window(db_session, board_member):
    event = _create_event(
        db_session,
        starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    from app.services.event_checkin_service import (
        CheckInWindowClosedError,
        perform_guest_checkin,
    )

    with pytest.raises(CheckInWindowClosedError):
        perform_guest_checkin(
            db_session,
            event_id=event.id,
            token=token,
            guest_name="Guest",
            as_of=datetime(2030, 5, 30, 12, 0, tzinfo=UTC),
        )


def test_checkins_list_includes_guests(client, board_headers, db_session, board_member):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={"token": token, "guest_name": "Public Guest"},
    )

    response = client.get(
        f"/api/v1/events/{event.id}/checkins",
        headers=board_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["checkins"][0]["kind"] == "guest"
    assert body["checkins"][0]["full_name"] == "Public Guest"


def test_attendance_summary_includes_guest_count(
    client, board_headers, db_session, board_member
):
    now = datetime.now(UTC)
    event = _create_event(
        db_session,
        starts_at=now + timedelta(minutes=30),
        creator_id=board_member.id,
    )
    token = ensure_checkin_token(db_session, event)

    client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={"token": token, "guest_name": "Guest One"},
    )
    client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={"token": token, "guest_name": "Guest Two"},
    )

    response = client.get(
        f"/api/v1/events/{event.id}/attendance-summary",
        headers=board_headers,
    )

    assert response.status_code == 200
    assert response.json()["guests_checked_in"]["count"] == 2
