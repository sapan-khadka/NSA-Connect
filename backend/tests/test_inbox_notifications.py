from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.core.security import hash_password
from app.models.inbox_notification import InboxNotification
from app.models.member import Member, MemberStatus
from app.services.inbox_notification_service import (
    create_inbox_notification,
    list_inbox_notifications,
)


def test_inbox_list_mark_read_and_mark_all(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    member = db_session.query(Member).filter(Member.email == "sapan@semo.edu").one()

    first = create_inbox_notification(
        db_session,
        member_id=member.id,
        type="task_assigned",
        title="Task one",
        href="/events/tasks",
        dedupe_key="t1",
    )
    second = create_inbox_notification(
        db_session,
        member_id=member.id,
        type="task_assigned",
        title="Task two",
        href="/events/tasks",
        dedupe_key="t2",
    )
    assert first is not None and second is not None

    headers = auth_header(client)
    listed = client.get("/api/v1/notifications", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 2
    assert body["unread_count"] == 2
    assert len(body["notifications"]) == 2

    marked = client.patch(
        f"/api/v1/notifications/{first.id}/read",
        headers=headers,
    )
    assert marked.status_code == 200
    assert marked.json()["unread"] is False

    listed_after = client.get("/api/v1/notifications", headers=headers)
    assert listed_after.json()["unread_count"] == 1

    all_read = client.post("/api/v1/notifications/read-all", headers=headers)
    assert all_read.status_code == 200
    assert all_read.json()["marked_count"] == 1
    assert client.get("/api/v1/notifications", headers=headers).json()[
        "unread_count"
    ] == 0


def test_pending_member_notifies_board(client, db_session):
    create_board_member(db_session)
    register_member(client, email="new@semo.edu", student_id="33333333")
    # registration creates pending member and should notify board
    pending = (
        db_session.query(Member).filter(Member.email == "new@semo.edu").one()
    )
    assert pending.status == MemberStatus.PENDING

    board = (
        db_session.query(Member).filter(Member.email == "board@semo.edu").one()
    )
    rows = (
        db_session.query(InboxNotification)
        .filter(InboxNotification.member_id == board.id)
        .all()
    )
    assert len(rows) == 1
    assert rows[0].type == "member_pending"
    assert "/members?tab=pending" in (rows[0].href or "")


def test_inbox_dedupe_key(db_session):
    member = Member(
        full_name="Solo",
        email="solo@semo.edu",
        student_id="44444444",
        major="CS",
        graduation_year=2028,
        hashed_password=hash_password("Password1!"),
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)

    first = create_inbox_notification(
        db_session,
        member_id=member.id,
        type="task_due_reminder",
        title="Due",
        dedupe_key="due:1",
    )
    second = create_inbox_notification(
        db_session,
        member_id=member.id,
        type="task_due_reminder",
        title="Due again",
        dedupe_key="due:1",
    )
    assert first is not None
    assert second is None
    assert list_inbox_notifications(db_session, member_id=member.id).total == 1


def test_creating_announcement_notifies_other_members(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.announcement_notification_service.notify_announcement_broadcast",
        lambda *_args, **_kwargs: None,
    )

    register_member(client, email="reader@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="reader@semo.edu")
    create_board_member(db_session)

    response = client.post(
        "/api/v1/announcements",
        headers=auth_header(client, email="board@semo.edu"),
        json={
            "title": "Dashain planning",
            "body": "Please RSVP this week.",
            "category": "general",
        },
    )
    assert response.status_code == 201

    reader = db_session.query(Member).filter(Member.email == "reader@semo.edu").one()
    rows = (
        db_session.query(InboxNotification)
        .filter(InboxNotification.member_id == reader.id)
        .all()
    )
    assert len(rows) == 1
    assert rows[0].type == "announcement"
    assert rows[0].title == "Dashain planning"
    assert rows[0].href == "/announcements"


def test_cannot_mark_another_members_notification(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    board = create_board_member(db_session)

    note = create_inbox_notification(
        db_session,
        member_id=board.id,
        type="member_pending",
        title="Secret",
        dedupe_key="secret",
    )
    assert note is not None

    response = client.patch(
        f"/api/v1/notifications/{note.id}/read",
        headers=auth_header(client),
    )
    assert response.status_code == 404
