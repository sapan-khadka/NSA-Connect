import pytest
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


@pytest.fixture
def board_member(db_session):
    return create_board_member(db_session)


def test_president_can_set_member_position(client, president_headers, board_member):
    response = client.patch(
        f"/api/v1/members/{board_member.id}/position",
        json={"position": "event_manager"},
        headers=president_headers,
    )

    assert response.status_code == 200
    assert response.json()["position"] == "event_manager"


def test_position_defaults_to_member(client, president_headers, board_member):
    response = client.get(
        f"/api/v1/members/{board_member.id}",
        headers=president_headers,
    )
    assert response.status_code == 200
    assert response.json()["position"] == "member"


def test_non_president_cannot_set_position(client, db_session, board_member):
    register_member(client)
    set_member_approved(db_session)
    general_headers = auth_header(client)

    response = client.patch(
        f"/api/v1/members/{board_member.id}/position",
        json={"position": "secretary"},
        headers=general_headers,
    )
    assert response.status_code == 403


def test_set_position_missing_member_returns_404(client, president_headers):
    response = client.patch(
        "/api/v1/members/9999/position",
        json={"position": "secretary"},
        headers=president_headers,
    )
    assert response.status_code == 404


def test_set_position_rejects_invalid_value(client, president_headers, board_member):
    response = client.patch(
        f"/api/v1/members/{board_member.id}/position",
        json={"position": "supreme_leader"},
        headers=president_headers,
    )
    assert response.status_code == 422


def test_assigning_exclusive_position_demotes_previous_holder(
    client,
    president_headers,
    db_session,
):
    from app.models.member import MemberPosition

    first = create_board_member(db_session, email="first@semo.edu")
    first.student_id = "33333333"
    db_session.commit()
    db_session.refresh(first)

    second = create_board_member(db_session, email="second@semo.edu")
    second.student_id = "44444444"
    db_session.commit()
    db_session.refresh(second)

    first_response = client.patch(
        f"/api/v1/members/{first.id}/position",
        json={"position": "secretary"},
        headers=president_headers,
    )
    assert first_response.status_code == 200
    assert first_response.json()["position"] == "secretary"

    second_response = client.patch(
        f"/api/v1/members/{second.id}/position",
        json={"position": "secretary"},
        headers=president_headers,
    )
    assert second_response.status_code == 200
    assert second_response.json()["position"] == "secretary"

    first_after = client.get(
        f"/api/v1/members/{first.id}",
        headers=president_headers,
    )
    assert first_after.json()["position"] == "member"

    db_session.refresh(first)
    db_session.refresh(second)
    assert first.position == MemberPosition.MEMBER
    assert second.position == MemberPosition.SECRETARY


def test_president_position_syncs_auth_role_and_demotes_previous(
    client,
    president_headers,
    db_session,
):
    from app.models.member import MemberPosition, MemberRole

    first = create_board_member(db_session, email="first@semo.edu")
    first.student_id = "55555555"
    db_session.commit()
    db_session.refresh(first)

    second = create_board_member(db_session, email="second@semo.edu")
    second.student_id = "66666666"
    second.role = MemberRole.PRESIDENT
    db_session.commit()
    db_session.refresh(second)

    response = client.patch(
        f"/api/v1/members/{first.id}/position",
        json={"position": "president"},
        headers=president_headers,
    )
    assert response.status_code == 200
    assert response.json()["position"] == "president"
    assert response.json()["role"] == "president"

    db_session.refresh(first)
    db_session.refresh(second)
    assert first.position == MemberPosition.PRESIDENT
    assert first.role == MemberRole.PRESIDENT
    assert second.position == MemberPosition.MEMBER
    assert second.role == MemberRole.BOARD
