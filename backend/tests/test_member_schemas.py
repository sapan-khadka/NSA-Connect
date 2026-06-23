import pytest
from pydantic import ValidationError

from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.member import (
    SENSITIVE_MEMBER_FIELDS,
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
VALID_CREATE = {
    "full_name": "Sapan Khadka",
    "email": SEMO_EMAIL,
    "password": "securepass123",
    "student_id": "12345678",
    "major": "Computer Science",
    "graduation_year": 2028,
}


def test_member_create_request_valid_semo_email():
    data = MemberCreateRequest(**VALID_CREATE)
    assert data.email == "sapan@semo.edu"


def test_member_create_request_accepts_uppercase_semo_email():
    data = MemberCreateRequest(
        **{**VALID_CREATE, "email": "Sapan@SEMO.EDU"},
    )
    assert data.email == "sapan@semo.edu"


def test_member_create_request_rejects_non_semo_email():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberCreateRequest(**{**VALID_CREATE, "email": NON_SEMO_EMAIL})


def test_member_create_request_rejects_semo_email_lookalike():
    with pytest.raises(ValidationError, match="semo.edu"):
        MemberCreateRequest(**{**VALID_CREATE, "email": "sapan@semo.edu.evil.com"})


def test_member_create_request_rejects_short_password():
    with pytest.raises(ValidationError):
        MemberCreateRequest(**{**VALID_CREATE, "password": "short"})


def test_member_create_request_rejects_invalid_email():
    with pytest.raises(ValidationError):
        MemberCreateRequest(**{**VALID_CREATE, "email": "not-an-email"})


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
        student_id="12345678",
        major="Computer Science",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )

    response = MemberResponse.from_member(member)

    assert response.id == 1
    assert response.email == "sapan@semo.edu"
    assert response.public_fields().isdisjoint(SENSITIVE_MEMBER_FIELDS)


def test_member_response_model_dump_never_includes_sensitive_fields():
    member = Member(
        id=1,
        full_name="Sapan Khadka",
        email=SEMO_EMAIL,
        student_id="S12345678",
        major="Computer Science",
        graduation_year=2028,
        hashed_password="super-secret-hash",
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )

    payload = MemberResponse.from_member(member).model_dump()

    assert SENSITIVE_MEMBER_FIELDS.isdisjoint(payload.keys())


def test_member_response_strips_sensitive_fields_from_dict_input():
    response = MemberResponse.model_validate(
        {
            "id": 1,
            "full_name": "Sapan Khadka",
            "email": SEMO_EMAIL,
            "student_id": "S12345678",
            "major": "Computer Science",
            "graduation_year": 2028,
            "role": MemberRole.GENERAL,
            "status": MemberStatus.PENDING,
            "hashed_password": "super-secret-hash",
            "password": "plain-text-password",
        }
    )

    dumped = response.model_dump()
    assert "hashed_password" not in dumped
    assert "password" not in dumped


def test_member_response_from_orm_via_model_validate():
    member = Member(
        id=1,
        full_name="Sapan Khadka",
        email=SEMO_EMAIL,
        student_id="12345678",
        major="Computer Science",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )

    response = MemberResponse.model_validate(member)

    assert response.id == 1
    assert response.email == "sapan@semo.edu"
    assert SENSITIVE_MEMBER_FIELDS.isdisjoint(response.model_dump().keys())


def test_member_list_response():
    members = [
        MemberResponse(
            id=1,
            full_name="Alice",
            email="alice@semo.edu",
            student_id="87654321",
            major="Biology",
            graduation_year=2028,
            role=MemberRole.GENERAL,
            status=MemberStatus.APPROVED,
        )
    ]
    data = MemberListResponse(members=members, total=1)
    assert data.total == 1
    assert len(data.members) == 1
