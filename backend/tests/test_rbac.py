import pytest
from fastapi import HTTPException

from app.core.dependencies import require_board, require_treasurer
from app.models.member import Member, MemberRole, MemberStatus


def _member(role: MemberRole) -> Member:
    return Member(
        id=1,
        full_name="Test User",
        email="test@semo.edu",
        hashed_password="hashed",
        role=role,
        status=MemberStatus.APPROVED,
    )


@pytest.mark.parametrize(
    "role",
    [MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT],
)
def test_require_board_allows_board_and_above(role):
    member = _member(role)
    assert require_board(current_member=member) == member


@pytest.mark.parametrize(
    "role",
    [MemberRole.GENERAL],
)
def test_require_board_rejects_below_board(role):
    member = _member(role)
    with pytest.raises(HTTPException) as exc:
        require_board(current_member=member)

    assert exc.value.status_code == 403
    assert exc.value.detail == "Requires board role or higher"


@pytest.mark.parametrize(
    "role",
    [MemberRole.TREASURER, MemberRole.PRESIDENT],
)
def test_require_treasurer_allows_treasurer_and_above(role):
    member = _member(role)
    assert require_treasurer(current_member=member) == member


@pytest.mark.parametrize(
    "role",
    [MemberRole.GENERAL, MemberRole.BOARD],
)
def test_require_treasurer_rejects_below_treasurer(role):
    member = _member(role)
    with pytest.raises(HTTPException) as exc:
        require_treasurer(current_member=member)

    assert exc.value.status_code == 403
    assert exc.value.detail == "Requires treasurer role or higher"
