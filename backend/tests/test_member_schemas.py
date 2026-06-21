import pytest
from pydantic import ValidationError

from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.member import (
    MemberCreateRequest,
    MemberListResponse,
    MemberLoginRequest,
    MemberResponse,
    MemberRoleUpdateRequest,
    MemberStatusUpdateRequest,
    MemberUpdateRequest,
)

SEMO_EMAIL = "sapan@semo.edu"
NON_SEMO_EMAIL = "sapan@gmail.com"


def test_member_create_request_valid_semo_email():
    data = MemberCreateRequest(
        full_name="Sapan Khadka",
        email=SEMO_EMAIL,
        password="securepass123",
    )
    assert data.email == "sapan@semo.edu"


def test_member_create_request_accepts_uppercase_semo_email():
    data = MemberCreateRequest(
        full_name="Sapan Khadka",
        email="Sapan@SEMO.EDU",
        password="securepass123",
    )
    assert data.email == "sapan@semo.edu"


def test_member_create_request_rejects_non_semo_email():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberCreateRequest(
            full_name="Sapan Khadka",
            email=NON_SEMO_EMAIL,
            password="securepass123",
        )


def test_member_create_request_rejects_semo_email_lookalike():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberCreateRequest(
            full_name="Sapan Khadka",
            email="sapan@semo.edu.evil.com",
            password="securepass123",
        )


def test_member_create_request_rejects_short_password():
    with pytest.raises(ValidationError):
        MemberCreateRequest(
            full_name="Sapan Khadka",
            email=SEMO_EMAIL,
            password="short",
        )


def test_member_create_request_rejects_invalid_email():
    with pytest.raises(ValidationError):
        MemberCreateRequest(
            full_name="Sapan Khadka",
            email="not-an-email",
            password="securepass123",
        )


def test_member_update_request_partial():
    data = MemberUpdateRequest(full_name="New Name")
    assert data.full_name == "New Name"
    assert data.email is None


def test_member_update_request_rejects_non_semo_email():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberUpdateRequest(email=NON_SEMO_EMAIL)


def test_member_login_request_requires_semo_email():
    data = MemberLoginRequest(email=SEMO_EMAIL, password="secret")
    assert data.email == "sapan@semo.edu"


def test_member_login_request_rejects_non_semo_email():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberLoginRequest(email=NON_SEMO_EMAIL, password="secret")


def test_member_role_update_request():
    data = MemberRoleUpdateRequest(role=MemberRole.BOARD)
    assert data.role == MemberRole.BOARD


def test_member_status_update_request():
    data = MemberStatusUpdateRequest(status=MemberStatus.APPROVED)
    assert data.status == MemberStatus.APPROVED


def test_member_response_from_model():
    member = Member(
        id=1,
        full_name="Sapan Khadka",
        email=SEMO_EMAIL,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )

    response = MemberResponse.model_validate(member)

    assert response.id == 1
    assert response.email == "sapan@semo.edu"
    assert not hasattr(response, "password")
    assert not hasattr(response, "hashed_password")


def test_member_list_response():
    members = [
        MemberResponse(
            id=1,
            full_name="Alice",
            email="alice@semo.edu",
            role=MemberRole.GENERAL,
            status=MemberStatus.APPROVED,
        )
    ]
    data = MemberListResponse(members=members, total=1)
    assert data.total == 1
    assert len(data.members) == 1
