from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.announcement import Announcement
from app.models.member import Member
from app.models.notification_sent_log import NotificationSentLog, NotificationType
from conftest import auth_header, create_board_member, register_member, set_member_approved


@pytest.fixture
def board_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


@pytest.fixture
def member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def test_board_can_create_announcement(client, board_headers, db_session):
    with patch(
        "app.services.announcement_service.notify_announcement_broadcast",
        return_value={"candidates": 1, "sent": 1, "skipped": 0},
    ):
        response = client.post(
            "/api/v1/announcements",
            headers=board_headers,
            json={
                "title": "General Meeting",
                "body": "All members please attend.",
                "category": "general",
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "General Meeting"
    assert body["author"]["full_name"] == "Board Member"


def test_member_cannot_create_announcement(client, member_headers):
    response = client.post(
        "/api/v1/announcements",
        headers=member_headers,
        json={
            "title": "Blocked",
            "body": "Should fail",
        },
    )

    assert response.status_code == 403


def test_all_members_can_list_announcements(client, board_headers, member_headers, db_session):
    board_member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    db_session.add(
        Announcement(
            title="Welcome",
            body="Hello NSA",
            author_id=board_member.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        ),
    )
    db_session.commit()

    board_response = client.get("/api/v1/announcements", headers=board_headers)
    member_response = client.get("/api/v1/announcements", headers=member_headers)

    assert board_response.status_code == 200
    assert member_response.status_code == 200
    assert board_response.json()["total"] == 1
    assert member_response.json()["announcements"][0]["title"] == "Welcome"


def test_create_announcement_sends_email_to_opted_in_members(
    client,
    board_headers,
    db_session,
):
    register_member(client, email="optin@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="optin@semo.edu")
    optin = db_session.scalar(select(Member).where(Member.email == "optin@semo.edu"))
    optin.notify_announcements = True

    register_member(client, email="optout@semo.edu", student_id="44444444")
    set_member_approved(db_session, email="optout@semo.edu")
    optout = db_session.scalar(select(Member).where(Member.email == "optout@semo.edu"))
    optout.notify_announcements = False
    db_session.commit()

    with patch(
        "app.services.announcement_notification_service.send_announcement_email",
        return_value="email-id",
    ) as send_mock:
        response = client.post(
            "/api/v1/announcements",
            headers=board_headers,
            json={
                "title": "Urgent update",
                "body": "Please read carefully.",
                "category": "urgent",
            },
        )

    assert response.status_code == 201
    announcement_id = response.json()["id"]

    sent_emails = [call.kwargs["to_email"] for call in send_mock.call_args_list]
    assert "optin@semo.edu" in sent_emails
    assert "optout@semo.edu" not in sent_emails

    logs = db_session.scalars(
        select(NotificationSentLog).where(
            NotificationSentLog.notification_type == NotificationType.ANNOUNCEMENT,
            NotificationSentLog.announcement_id == announcement_id,
        ),
    ).all()
    assert len(logs) >= 1


def test_board_can_update_and_delete_announcement(client, board_headers, db_session):
    board_member = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    announcement = Announcement(
        title="Old title",
        body="Old body",
        author_id=board_member.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(announcement)
    db_session.commit()

    update = client.patch(
        f"/api/v1/announcements/{announcement.id}",
        headers=board_headers,
        json={"title": "New title"},
    )
    assert update.status_code == 200
    assert update.json()["title"] == "New title"

    delete = client.delete(
        f"/api/v1/announcements/{announcement.id}",
        headers=board_headers,
    )
    assert delete.status_code == 204

    listing = client.get("/api/v1/announcements", headers=board_headers)
    assert listing.json()["total"] == 0
