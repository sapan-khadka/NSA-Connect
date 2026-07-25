"""Mute, WS tickets, and discussion message inbox notifications."""

from conftest import auth_header, register_member, set_member_approved
from sqlalchemy import select

from app.core.security import TokenType, decode_ws_ticket
from app.models.inbox_notification import InboxNotification, InboxNotificationType
from app.models.member import Member
from app.services.discussion_realtime_sync import reset_discussion_sync_redis


def _approve_named(client, db_session, *, email: str, student_id: str) -> int:
    register_member(client, email=email, student_id=student_id)
    set_member_approved(db_session, email=email)
    member = db_session.scalar(select(Member).where(Member.email == email))
    assert member is not None
    return member.id


def test_ws_ticket_is_short_lived_ws_type(client, db_session):
    _approve_named(
        client, db_session, email="ticket@semo.edu", student_id="22220001"
    )
    headers = auth_header(client, email="ticket@semo.edu")

    response = client.post("/api/v1/discussions/ws-ticket", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["expires_at"]

    payload = decode_ws_ticket(body["token"])
    assert payload["typ"] == TokenType.WS.value
    assert payload["email"] == "ticket@semo.edu"


def test_dm_message_creates_inbox_notification_and_respects_mute(
    client, db_session, monkeypatch
):
    reset_discussion_sync_redis(None)
    monkeypatch.setattr(
        "app.services.discussion_message_notify_service.user_present_in_room",
        lambda *_args, **_kwargs: False,
    )
    monkeypatch.setattr(
        "app.services.discussion_message_notify_service.publish_user_notification",
        lambda *_args, **_kwargs: None,
    )

    alice_id = _approve_named(
        client, db_session, email="alice-n@semo.edu", student_id="22220011"
    )
    bob_id = _approve_named(
        client, db_session, email="bob-n@semo.edu", student_id="22220012"
    )
    del alice_id
    alice = auth_header(client, email="alice-n@semo.edu")
    bob = auth_header(client, email="bob-n@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_id = room["id"]
    room_key = f"room:{room_id}"

    posted = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=alice,
        json={"content": "Ping from Alice"},
    )
    assert posted.status_code == 201

    notifications = list(
        db_session.scalars(
            select(InboxNotification).where(
                InboxNotification.member_id == bob_id,
                InboxNotification.type == InboxNotificationType.DISCUSSION_MESSAGE,
            )
        ).all()
    )
    assert len(notifications) == 1
    assert notifications[0].title
    assert "Ping from Alice" in (notifications[0].body or "")
    assert notifications[0].href == f"/discussions/room/{room_id}"

    mute = client.post(
        "/api/v1/discussions/mutes/toggle",
        headers=bob,
        json={"room_id": room_key},
    )
    assert mute.status_code == 200
    assert mute.json() == {"room_id": room_key, "muted": True}

    inbox = client.get("/api/v1/discussions/inbox", headers=bob).json()
    match = next(item for item in inbox["rooms"] if item["room_id"] == room_key)
    assert match["muted"] is True

    posted_muted = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=alice,
        json={"content": "Should be silent"},
    )
    assert posted_muted.status_code == 201

    notifications_after = list(
        db_session.scalars(
            select(InboxNotification).where(
                InboxNotification.member_id == bob_id,
                InboxNotification.type == InboxNotificationType.DISCUSSION_MESSAGE,
            )
        ).all()
    )
    assert len(notifications_after) == 1
