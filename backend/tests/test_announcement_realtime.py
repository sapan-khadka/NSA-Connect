from datetime import UTC, datetime

from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import func, select

from app.integrations.resend_client import ResendDeliveryError
from app.models.event import Event
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.inbox_notification import InboxNotification
from app.models.member import Member
from app.models.organization import Organization, OrganizationStatus
from app.models.organization_membership import OrganizationMembership
from app.services.inbox_notification_service import notify_announcement_published
from app.services.organization_context import get_default_organization_id


def _create_event(client, headers) -> int:
    response = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "name": "Nepali Cultural Night 2026",
            "starts_at": "2030-03-15T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Food, music, and dance.",
            "location": "UC ballroom",
            "budget": "0.00",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_announcement_inbox_ignores_resend_and_email_preferences(
    client,
    db_session,
    monkeypatch,
):
    register_member(client, email="reader@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="reader@semo.edu")
    register_member(client, email="quiet@semo.edu", student_id="66666666")
    set_member_approved(db_session, email="quiet@semo.edu")
    create_board_member(db_session)

    reader = db_session.scalar(select(Member).where(Member.email == "reader@semo.edu"))
    quiet = db_session.scalar(select(Member).where(Member.email == "quiet@semo.edu"))
    author = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    reader.notify_announcements = True
    quiet.notify_announcements = False
    db_session.commit()

    order: list[tuple] = []

    def publish(user_id, payload):
        order.append(("ws", user_id, payload["type"]))

    def send_email(**kwargs):
        order.append(("email", kwargs["to_email"]))
        raise ResendDeliveryError("RESEND_API_KEY is not configured")

    monkeypatch.setattr(
        "app.services.discussion_realtime_sync.publish_user_notification",
        publish,
    )
    monkeypatch.setattr(
        "app.services.announcement_notification_service.send_announcement_email",
        send_email,
    )

    response = client.post(
        "/api/v1/announcements",
        headers=auth_header(client, email="board@semo.edu"),
        json={
            "title": "Cultural night",
            "body": "Join us in the ballroom.",
            "category": "general",
        },
    )
    assert response.status_code == 201
    announcement_id = response.json()["id"]

    assert order[0][0] == "ws"
    assert ("email", "reader@semo.edu") in order
    assert ("email", "quiet@semo.edu") not in order
    ws_ids = {item[1] for item in order if item[0] == "ws"}
    assert reader.id in ws_ids
    assert quiet.id in ws_ids
    assert author.id not in ws_ids
    assert all(item[2] == "inbox_notification" for item in order if item[0] == "ws")

    for member_id in (reader.id, quiet.id):
        rows = db_session.scalars(
            select(InboxNotification).where(InboxNotification.member_id == member_id)
        ).all()
        assert len(rows) == 1
        assert rows[0].type == "announcement"
        assert rows[0].href == f"/announcements?id={announcement_id}"
        assert rows[0].read_at is None

    author_rows = db_session.scalar(
        select(func.count())
        .select_from(InboxNotification)
        .where(InboxNotification.member_id == author.id)
    )
    assert author_rows == 0


def test_repeat_publish_does_not_duplicate_inbox_or_websocket(
    client,
    db_session,
    monkeypatch,
):
    register_member(client, email="reader@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="reader@semo.edu")
    create_board_member(db_session)
    published: list[int] = []
    monkeypatch.setattr(
        "app.services.discussion_realtime_sync.publish_user_notification",
        lambda user_id, _payload: published.append(user_id),
    )
    monkeypatch.setattr(
        "app.services.announcement_notification_service.notify_announcement_broadcast",
        lambda *_args, **_kwargs: None,
    )

    response = client.post(
        "/api/v1/announcements",
        headers=auth_header(client, email="board@semo.edu"),
        json={
            "title": "Once",
            "body": "First publish.",
            "category": "general",
        },
    )
    assert response.status_code == 201
    reader = db_session.scalar(select(Member).where(Member.email == "reader@semo.edu"))
    author = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    from app.models.announcement import Announcement

    announcement = db_session.get(Announcement, response.json()["id"])
    again = notify_announcement_published(
        db_session,
        announcement_id=announcement.id,
        title=announcement.title,
        author=author,
        announcement=announcement,
    )
    assert again == []
    assert published.count(reader.id) == 1
    count = db_session.scalar(
        select(func.count())
        .select_from(InboxNotification)
        .where(InboxNotification.member_id == reader.id)
    )
    assert count == 1


def test_announcement_notifications_follow_audience_and_organization(
    client,
    db_session,
    monkeypatch,
):
    register_member(client, email="going@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="going@semo.edu")
    register_member(client, email="maybe@semo.edu", student_id="66666666")
    set_member_approved(db_session, email="maybe@semo.edu")
    register_member(client, email="outsider@semo.edu", student_id="77777777")
    set_member_approved(db_session, email="outsider@semo.edu")
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")
    event_id = _create_event(client, headers)

    going = db_session.scalar(select(Member).where(Member.email == "going@semo.edu"))
    maybe = db_session.scalar(select(Member).where(Member.email == "maybe@semo.edu"))
    outsider = db_session.scalar(
        select(Member).where(Member.email == "outsider@semo.edu")
    )
    now = datetime.now(UTC)
    db_session.add_all(
        [
            EventRsvp(
                event_id=event_id,
                member_id=going.id,
                status=RsvpStatus.GOING,
                created_at=now,
                updated_at=now,
            ),
            EventRsvp(
                event_id=event_id,
                member_id=maybe.id,
                status=RsvpStatus.MAYBE,
                created_at=now,
                updated_at=now,
            ),
        ]
    )
    default_org = db_session.get(Organization, get_default_organization_id(db_session))
    other = Organization(
        university_id=default_org.university_id,
        name="Other Chapter",
        slug="other-chapter",
        status=OrganizationStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.flush()
    membership = db_session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == outsider.id
        )
    )
    membership.organization_id = other.id
    db_session.commit()

    published: list[int] = []

    def send_email(**_kwargs):
        raise ResendDeliveryError("RESEND_API_KEY is not configured")

    monkeypatch.setattr(
        "app.services.discussion_realtime_sync.publish_user_notification",
        lambda user_id, _payload: published.append(user_id),
    )
    monkeypatch.setattr(
        "app.services.announcement_notification_service.send_announcement_email",
        send_email,
    )

    response = client.post(
        "/api/v1/announcements",
        headers=headers,
        json={
            "title": "Going reminder",
            "body": "See you Friday.",
            "category": "event_related",
            "audience": "going",
            "event_id": event_id,
        },
    )
    assert response.status_code == 201

    def inbox_count(member_id: int) -> int:
        return db_session.scalar(
            select(func.count())
            .select_from(InboxNotification)
            .where(InboxNotification.member_id == member_id)
        )

    assert inbox_count(going.id) == 1
    assert inbox_count(maybe.id) == 0
    assert inbox_count(outsider.id) == 0
    author = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    assert inbox_count(author.id) == 0
    assert published == [going.id]
    assert db_session.get(Event, event_id).organization_id == default_org.id
