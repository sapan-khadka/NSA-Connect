from conftest import (
    VALID_EMAIL,
    login_member,
    register_member,
    set_member_approved,
)

from app.core.ws_auth import authenticate_member_from_token


def test_ws_auth_attaches_organization_membership(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    token = login_member(client).json()["access_token"]

    member = authenticate_member_from_token(db_session, token)

    assert member.email == VALID_EMAIL
    assert getattr(member, "_active_organization_id", None) is not None
    assert getattr(member, "_active_membership", None) is not None
    assert member._active_membership.organization_id == member._active_organization_id
