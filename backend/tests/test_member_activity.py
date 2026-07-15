from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event_checkin import EventCheckIn
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.member_dues import MemberDues


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
def treasurer_headers(client, db_session):
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


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


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_self_activity_includes_task_dues_and_checkin_sorted(
    client,
    db_session,
    president_headers,
    general_member,
    general_headers,
):
    event = _create_event(client, president_headers)
    task_response = client.post(
        f"/api/v1/events/{event['id']}/event-tasks",
        json={"title": "Book venue", "assignee_id": general_member.id},
        headers=president_headers,
    )
    assert task_response.status_code == 201
    task = task_response.json()

    done = client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done"},
        headers=general_headers,
    )
    assert done.status_code == 200

    t0 = datetime.now(UTC) - timedelta(days=2)
    t1 = datetime.now(UTC) - timedelta(days=1)
    dues = MemberDues(
        member_id=general_member.id,
        semester="2026-fall",
        amount_owed=Decimal("20.00"),
        amount_paid=Decimal("20.00"),
        paid_at=t0,
    )
    checkin = EventCheckIn(
        event_id=event["id"],
        member_id=general_member.id,
        checked_in_at=t1,
    )
    db_session.add_all([dues, checkin])
    db_session.commit()

    response = client.get(
        f"/api/v1/members/{general_member.id}/activity",
        headers=general_headers,
    )
    assert response.status_code == 200
    body = response.json()
    types = [item["type"] for item in body["items"]]
    assert types == ["task_completed", "event_checkin", "dues_paid"]
    assert body["items"][0]["description"].startswith("Completed 'Book venue'")
    assert body["items"][1]["event_id"] == event["id"]
    assert body["items"][2]["dues_record_id"] == dues.id


def test_president_sees_tasks_for_another_member(
    client,
    db_session,
    president_headers,
    general_member,
    general_headers,
):
    event = _create_event(client, president_headers)
    task = client.post(
        f"/api/v1/events/{event['id']}/event-tasks",
        json={"title": "Print flyers", "assignee_id": general_member.id},
        headers=president_headers,
    ).json()
    client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done"},
        headers=general_headers,
    )

    response = client.get(
        f"/api/v1/members/{general_member.id}/activity",
        headers=president_headers,
    )
    assert response.status_code == 200
    assert any(item["type"] == "task_completed" for item in response.json()["items"])


def test_board_without_oversight_does_not_see_others_tasks(
    client,
    db_session,
    president_headers,
    board_headers,
    general_member,
    general_headers,
):
    event = _create_event(client, president_headers)
    task = client.post(
        f"/api/v1/events/{event['id']}/event-tasks",
        json={"title": "Secret task", "assignee_id": general_member.id},
        headers=president_headers,
    ).json()
    client.patch(
        f"/api/v1/event-tasks/{task['id']}",
        json={"status": "done"},
        headers=general_headers,
    )

    response = client.get(
        f"/api/v1/members/{general_member.id}/activity",
        headers=board_headers,
    )
    assert response.status_code == 200
    assert all(
        item["type"] != "task_completed" for item in response.json()["items"]
    )


def test_treasurer_sees_others_dues_board_sees_checkins(
    client,
    db_session,
    president_headers,
    treasurer_headers,
    board_headers,
    general_member,
):
    event = _create_event(client, president_headers)
    dues = MemberDues(
        member_id=general_member.id,
        semester="2026-fall",
        amount_owed=Decimal("20.00"),
        amount_paid=Decimal("20.00"),
        paid_at=datetime.now(UTC),
    )
    checkin = EventCheckIn(
        event_id=event["id"],
        member_id=general_member.id,
        checked_in_at=datetime.now(UTC),
    )
    db_session.add_all([dues, checkin])
    db_session.commit()

    treasurer_view = client.get(
        f"/api/v1/members/{general_member.id}/activity",
        headers=treasurer_headers,
    )
    assert treasurer_view.status_code == 200
    treasurer_types = {item["type"] for item in treasurer_view.json()["items"]}
    assert "dues_paid" in treasurer_types
    assert "event_checkin" in treasurer_types

    board_view = client.get(
        f"/api/v1/members/{general_member.id}/activity",
        headers=board_headers,
    )
    assert board_view.status_code == 200
    board_types = {item["type"] for item in board_view.json()["items"]}
    assert "event_checkin" in board_types
    assert "dues_paid" not in board_types


def test_general_member_cannot_see_peer_dues_or_checkins(
    client,
    db_session,
    president_headers,
    general_headers,
):
    peer = Member(
        full_name="Peer Member",
        email="peer@semo.edu",
        student_id="99999999",
        major="CS",
        graduation_year=2028,
        hashed_password="hashed",
        status=MemberStatus.APPROVED,
        role=MemberRole.GENERAL,
        position=MemberPosition.MEMBER,
        talents=[],
    )
    db_session.add(peer)
    db_session.commit()

    event = _create_event(client, president_headers)
    db_session.add_all(
        [
            MemberDues(
                member_id=peer.id,
                semester="2026-fall",
                amount_owed=Decimal("20.00"),
                amount_paid=Decimal("20.00"),
                paid_at=datetime.now(UTC),
            ),
            EventCheckIn(
                event_id=event["id"],
                member_id=peer.id,
                checked_in_at=datetime.now(UTC),
            ),
        ],
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/members/{peer.id}/activity",
        headers=general_headers,
    )
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_my_dues_status_includes_paid_at(
    client,
    db_session,
    treasurer_headers,
    general_member,
    general_headers,
):
    paid_at = datetime(2026, 3, 1, 12, 0, tzinfo=UTC)
    db_session.add(
        MemberDues(
            member_id=general_member.id,
            semester="2026-fall",
            amount_owed=Decimal("20.00"),
            amount_paid=Decimal("20.00"),
            paid_at=paid_at,
        ),
    )
    db_session.commit()

    response = client.get(
        "/api/v1/finance/dues/mine?semester=2026-fall",
        headers=general_headers,
    )
    assert response.status_code == 200
    assert response.json()["paid_at"] is not None
