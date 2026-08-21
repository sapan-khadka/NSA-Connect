"""Unit tests for shared auth member loading."""

import jwt
from conftest import register_member, set_member_approved
from sqlalchemy import select

from app.core.config import settings
from app.core.security import JWT_ALGORITHM, create_access_token
from app.models.member import Member
from app.services.auth_service import (
    InvalidTokenPayloadError,
    MemberNotApprovedError,
    TokenRevokedError,
    load_authenticated_member,
)


def _decode_payload(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])


def test_load_authenticated_member_returns_member(db_session, client):
    register_member(client)
    set_member_approved(db_session)

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    token, _ = create_access_token(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    loaded = load_authenticated_member(
        db_session, _decode_payload(token), attach_membership=False
    )
    assert loaded.id == member.id


def test_load_authenticated_member_rejects_revoked_token(db_session, client):
    register_member(client)
    set_member_approved(db_session)

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    token, _ = create_access_token(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )
    payload = _decode_payload(token)

    member.token_version += 1
    db_session.commit()

    try:
        load_authenticated_member(db_session, payload, attach_membership=False)
        raise AssertionError("expected TokenRevokedError")
    except TokenRevokedError:
        pass


def test_load_authenticated_member_rejects_unapproved(db_session, client):
    register_member(client)

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    token, _ = create_access_token(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    try:
        load_authenticated_member(
            db_session, _decode_payload(token), attach_membership=False
        )
        raise AssertionError("expected MemberNotApprovedError")
    except MemberNotApprovedError:
        pass


def test_load_authenticated_member_rejects_email_mismatch(db_session, client):
    register_member(client)
    set_member_approved(db_session)

    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    token, _ = create_access_token(
        member_id=member.id,
        email="other@semo.edu",
        role=member.role.value,
        token_version=member.token_version,
    )

    try:
        load_authenticated_member(
            db_session, _decode_payload(token), attach_membership=False
        )
        raise AssertionError("expected InvalidTokenPayloadError")
    except InvalidTokenPayloadError:
        pass
