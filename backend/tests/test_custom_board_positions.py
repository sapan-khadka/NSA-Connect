import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    register_member,
    set_member_approved,
)


@pytest.fixture
def president_headers(client, db_session):
    register_member(client, email="filler@semo.edu", student_id="22222222")
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


def _create_custom_position(client, president_headers, name="Cultural Lead"):
    response = client.post(
        "/api/v1/member-positions/custom",
        json={"name": name},
        headers=president_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _approved_member_id(client, db_session, *, email: str, student_id: str) -> int:
    from app.models.member import Member

    register_member(client, email=email, student_id=student_id)
    set_member_approved(db_session, email=email)
    member = db_session.scalar(select(Member).where(Member.email == email))
    assert member is not None
    return member.id


def test_member_can_list_position_catalog(client, president_headers, db_session):
    _approved_member_id(
        client,
        db_session,
        email="viewer@semo.edu",
        student_id="55555555",
    )
    headers = auth_header(client, email="viewer@semo.edu")

    _create_custom_position(client, president_headers, "Outreach Lead")

    response = client.get("/api/v1/member-positions", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    built_in_keys = {item["key"] for item in payload["built_in"]}
    assert "president" in built_in_keys
    assert "member" in built_in_keys
    assert any(item["name"] == "Outreach Lead" for item in payload["custom"])


def test_non_president_cannot_manage_custom_positions(client, db_session):
    _approved_member_id(
        client,
        db_session,
        email="general@semo.edu",
        student_id="66666666",
    )
    headers = auth_header(client, email="general@semo.edu")

    create = client.post(
        "/api/v1/member-positions/custom",
        json={"name": "Alumni Liaison"},
        headers=headers,
    )
    assert create.status_code == 403

    listing = client.get("/api/v1/member-positions/custom", headers=headers)
    assert listing.status_code == 403


def test_create_rejects_reserved_and_duplicate_names(client, president_headers):
    reserved = client.post(
        "/api/v1/member-positions/custom",
        json={"name": "Vice President"},
        headers=president_headers,
    )
    assert reserved.status_code == 400

    first = _create_custom_position(client, president_headers, "Tech Lead")
    duplicate = client.post(
        "/api/v1/member-positions/custom",
        json={"name": " tech  lead "},
        headers=president_headers,
    )
    assert duplicate.status_code == 409
    assert first["name"] == "Tech Lead"


def test_rename_and_archive_custom_position(client, president_headers):
    created = _create_custom_position(client, president_headers, "Media Lead")

    renamed = client.patch(
        f"/api/v1/member-positions/custom/{created['id']}",
        json={"name": "Digital Media Lead"},
        headers=president_headers,
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Digital Media Lead"
    assert renamed.json()["is_active"] is True

    archived = client.post(
        f"/api/v1/member-positions/custom/{created['id']}/archive",
        headers=president_headers,
    )
    assert archived.status_code == 200
    assert archived.json()["is_active"] is False
    assert archived.json()["archived_at"] is not None

    active_catalog = client.get("/api/v1/member-positions", headers=president_headers)
    assert all(
        item["id"] != created["id"] for item in active_catalog.json()["custom"]
    )

    with_archived = client.get(
        "/api/v1/member-positions",
        params={"include_archived": True},
        headers=president_headers,
    )
    assert any(
        item["id"] == created["id"] and item["is_active"] is False
        for item in with_archived.json()["custom"]
    )


def test_assign_custom_position_promotes_general_and_transfers(
    client,
    president_headers,
    db_session,
):
    from app.models.member import Member, MemberPosition, MemberRole

    position = _create_custom_position(client, president_headers, "Wellness Lead")
    first_id = _approved_member_id(
        client,
        db_session,
        email="firstholder@semo.edu",
        student_id="77777777",
    )

    second = create_board_member(db_session, email="secondholder@semo.edu")
    second.student_id = "88888888"
    db_session.commit()
    db_session.refresh(second)

    assigned = client.patch(
        f"/api/v1/members/{first_id}/position",
        json={"kind": "custom", "custom_board_position_id": position["id"]},
        headers=president_headers,
    )
    assert assigned.status_code == 200, assigned.text
    body = assigned.json()
    assert body["position"] == "member"
    assert body["role"] == "board"
    assert body["custom_board_position"]["id"] == position["id"]
    assert body["custom_board_position"]["name"] == "Wellness Lead"

    transferred = client.patch(
        f"/api/v1/members/{second.id}/position",
        json={"kind": "custom", "custom_board_position_id": position["id"]},
        headers=president_headers,
    )
    assert transferred.status_code == 200
    assert transferred.json()["custom_board_position"]["id"] == position["id"]

    previous = client.get(f"/api/v1/members/{first_id}", headers=president_headers)
    assert previous.json()["custom_board_position"] is None
    assert previous.json()["role"] == "board"

    db_session.expire_all()
    first_row = db_session.scalar(select(Member).where(Member.id == first_id))
    second_row = db_session.scalar(select(Member).where(Member.id == second.id))
    assert first_row.custom_board_position_id is None
    assert second_row.custom_board_position_id == position["id"]
    assert second_row.position == MemberPosition.MEMBER
    assert second_row.role == MemberRole.BOARD


def test_custom_assignment_clears_built_in_seat(
    client,
    president_headers,
    db_session,
):
    position = _create_custom_position(client, president_headers, "Logistics Lead")
    member = create_board_member(db_session, email="secretary@semo.edu")
    member.student_id = "99999991"
    db_session.commit()
    db_session.refresh(member)

    set_secretary = client.patch(
        f"/api/v1/members/{member.id}/position",
        json={"kind": "fixed", "position": "secretary"},
        headers=president_headers,
    )
    assert set_secretary.status_code == 200

    to_custom = client.patch(
        f"/api/v1/members/{member.id}/position",
        json={"kind": "custom", "custom_board_position_id": position["id"]},
        headers=president_headers,
    )
    assert to_custom.status_code == 200
    assert to_custom.json()["position"] == "member"
    assert to_custom.json()["custom_board_position"]["id"] == position["id"]


def test_fixed_assignment_clears_custom_seat(
    client,
    president_headers,
    db_session,
):
    position = _create_custom_position(client, president_headers, "Partnerships Lead")
    member = create_board_member(db_session, email="partner@semo.edu")
    member.student_id = "99999992"
    db_session.commit()
    db_session.refresh(member)

    assigned = client.patch(
        f"/api/v1/members/{member.id}/position",
        json={"kind": "custom", "custom_board_position_id": position["id"]},
        headers=president_headers,
    )
    assert assigned.status_code == 200

    to_fixed = client.patch(
        f"/api/v1/members/{member.id}/position",
        json={"kind": "fixed", "position": "event_manager"},
        headers=president_headers,
    )
    assert to_fixed.status_code == 200
    assert to_fixed.json()["position"] == "event_manager"
    assert to_fixed.json()["custom_board_position"] is None


def test_cannot_assign_archived_custom_position(
    client,
    president_headers,
    db_session,
):
    position = _create_custom_position(client, president_headers, "Archive Me")
    archived = client.post(
        f"/api/v1/member-positions/custom/{position['id']}/archive",
        headers=president_headers,
    )
    assert archived.status_code == 200

    member = create_board_member(db_session, email="archiveassignee@semo.edu")
    member.student_id = "99999993"
    db_session.commit()
    db_session.refresh(member)

    response = client.patch(
        f"/api/v1/members/{member.id}/position",
        json={"kind": "custom", "custom_board_position_id": position["id"]},
        headers=president_headers,
    )
    assert response.status_code == 409


def test_unique_custom_holder_constraint(db_session):
    from app.models.custom_board_position import CustomBoardPosition

    president = create_president_member(db_session)
    position = CustomBoardPosition(
        name="Unique Seat",
        name_normalized="unique seat",
        is_active=True,
        created_by_id=president.id,
    )
    db_session.add(position)
    db_session.commit()
    db_session.refresh(position)

    first = create_board_member(db_session, email="unique1@semo.edu")
    first.student_id = "11110001"
    first.custom_board_position_id = position.id
    db_session.commit()

    second = create_board_member(db_session, email="unique2@semo.edu")
    second.student_id = "11110002"
    second.custom_board_position_id = position.id
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
