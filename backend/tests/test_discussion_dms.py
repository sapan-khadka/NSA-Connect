"""Private 1:1 direct messages via discussion rooms."""

from conftest import (
    auth_header,
    create_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.member import Member


def _approve_named(client, db_session, *, email: str, student_id: str) -> int:
    register_member(client, email=email, student_id=student_id)
    set_member_approved(db_session, email=email)
    member = db_session.scalar(select(Member).where(Member.email == email))
    assert member is not None
    return member.id


def test_get_or_create_dm_is_idempotent(client, db_session):
    alice_id = _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110001"
    )
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110002"
    )
    alice = auth_header(client, email="alice@semo.edu")

    first = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["kind"] == "dm"
    assert body["status"] == "live"
    assert body["peer_member_id"] == bob_id
    assert body["href"] == f"/discussions/room/{body['id']}"
    room_id = body["id"]

    second = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    )
    assert second.status_code == 200
    assert second.json()["id"] == room_id

    bob = auth_header(client, email="bob@semo.edu")
    from_bob = client.post(
        "/api/v1/discussions/dms",
        headers=bob,
        json={"member_id": alice_id},
    )
    assert from_bob.status_code == 200
    assert from_bob.json()["id"] == room_id
    assert from_bob.json()["peer_member_id"] == alice_id


def test_dm_messaging_and_inbox_for_general_members(client, db_session):
    alice_id = _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110011"
    )
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110012"
    )
    alice = auth_header(client, email="alice@semo.edu")
    bob = auth_header(client, email="bob@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_id = room["id"]

    posted = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=alice,
        json={"content": "Hey Bob"},
    )
    assert posted.status_code == 201

    bob_inbox = client.get("/api/v1/discussions/inbox", headers=bob)
    assert bob_inbox.status_code == 200
    match = next(
        item
        for item in bob_inbox.json()["rooms"]
        if item["room_id"] == f"room:{room_id}"
    )
    assert match["event_type"] == "dm"
    assert match["label"]  # peer name
    assert "Hey Bob" in (match["last_message_preview"] or "")

    alice_inbox = client.get("/api/v1/discussions/inbox", headers=alice)
    alice_match = next(
        item
        for item in alice_inbox.json()["rooms"]
        if item["room_id"] == f"room:{room_id}"
    )
    assert alice_match["event_type"] == "dm"


def test_personal_archive_hides_dm_for_one_user_only(client, db_session):
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110042"
    )
    _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110041"
    )
    alice = auth_header(client, email="alice@semo.edu")
    bob = auth_header(client, email="bob@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_key = f"room:{room['id']}"

    assert (
        client.post(
            f"/api/v1/discussions/rooms/{room['id']}/messages",
            headers=alice,
            json={"content": "Hide me maybe"},
        ).status_code
        == 201
    )

    archived = client.post(
        "/api/v1/discussions/user-archives/toggle",
        json={"room_id": room_key},
        headers=bob,
    )
    assert archived.status_code == 200
    assert archived.json() == {
        "room_id": room_key,
        "archived_for_me": True,
    }

    bob_inbox = client.get("/api/v1/discussions/inbox", headers=bob).json()
    bob_active = {item["room_id"] for item in bob_inbox["rooms"]}
    bob_personal = {
        item["room_id"] for item in bob_inbox["personal_archived_rooms"]
    }
    assert room_key not in bob_active
    assert room_key in bob_personal

    alice_inbox = client.get("/api/v1/discussions/inbox", headers=alice).json()
    alice_active = {item["room_id"] for item in alice_inbox["rooms"]}
    assert room_key in alice_active

    restored = client.post(
        "/api/v1/discussions/user-archives/toggle",
        json={"room_id": room_key},
        headers=bob,
    )
    assert restored.json()["archived_for_me"] is False
    bob_inbox2 = client.get("/api/v1/discussions/inbox", headers=bob).json()
    assert room_key in {item["room_id"] for item in bob_inbox2["rooms"]}


def test_president_cannot_open_others_dm(client, db_session):
    create_president_member(db_session)
    alice_id = _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110021"
    )
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110022"
    )
    alice = auth_header(client, email="alice@semo.edu")
    president = auth_header(client, email="president@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_id = room["id"]

    forbidden = client.get(
        f"/api/v1/discussions/rooms/{room_id}",
        headers=president,
    )
    assert forbidden.status_code == 404

    forbidden_msg = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=president,
        json={"content": "Oversight should fail"},
    )
    assert forbidden_msg.status_code == 404

    forbidden_list = client.get(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=president,
    )
    assert forbidden_list.status_code == 404
    assert alice_id != bob_id


def test_third_party_cannot_access_dm_messages(client, db_session):
    alice_id = _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110041"
    )
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110042"
    )
    _approve_named(
        client, db_session, email="carol@semo.edu", student_id="11110043"
    )
    alice = auth_header(client, email="alice@semo.edu")
    carol = auth_header(client, email="carol@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_id = room["id"]
    posted = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=alice,
        json={"content": "private"},
    )
    assert posted.status_code == 201
    message_id = posted.json()["id"]

    assert (
        client.get(
            f"/api/v1/discussions/rooms/{room_id}/messages",
            headers=carol,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/discussions/rooms/{room_id}/messages",
            headers=carol,
            json={"content": "intrusion"},
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/discussions/messages/{message_id}",
            headers=carol,
        ).status_code
        == 404
    )
    assert alice_id != bob_id


def test_author_can_soft_delete_own_message(client, db_session):
    _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110051"
    )
    bob_id = _approve_named(
        client, db_session, email="bob@semo.edu", student_id="11110052"
    )
    alice = auth_header(client, email="alice@semo.edu")
    bob = auth_header(client, email="bob@semo.edu")

    room = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": bob_id},
    ).json()
    room_id = room["id"]
    message_id = client.post(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=alice,
        json={"content": "oops secret"},
    ).json()["id"]

    deleted = client.delete(
        f"/api/v1/discussions/messages/{message_id}",
        headers=alice,
    )
    assert deleted.status_code == 200
    body = deleted.json()
    assert body["is_deleted"] is True
    assert "deleted" in body["content"].lower()
    assert "secret" not in body["content"]

    listed = client.get(
        f"/api/v1/discussions/rooms/{room_id}/messages",
        headers=bob,
    ).json()["messages"]
    match = next(item for item in listed if item["id"] == message_id)
    assert match["is_deleted"] is True
    assert "secret" not in match["content"]


def test_cannot_dm_self_or_unknown(client, db_session):
    alice_id = _approve_named(
        client, db_session, email="alice@semo.edu", student_id="11110031"
    )
    alice = auth_header(client, email="alice@semo.edu")

    self_dm = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": alice_id},
    )
    assert self_dm.status_code == 422

    missing = client.post(
        "/api/v1/discussions/dms",
        headers=alice,
        json={"member_id": 999_999},
    )
    assert missing.status_code == 422
