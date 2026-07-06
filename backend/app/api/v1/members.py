import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board, require_president
from app.core.password_validation import WeakPasswordError
from app.core.security import create_token_pair
from app.lib.member_talents import ALL_MEMBER_TALENTS, MEMBER_TALENT_LABELS
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.auth import TokenResponse
from app.schemas.member import (
    MemberBoardRoleUpdateRequest,
    MemberListResponse,
    MemberPasswordChangeRequest,
    MemberPositionUpdateRequest,
    MemberProfileUpdateRequest,
    MemberResponse,
    MemberTalentOptionsResponse,
    PaginatedMemberListResponse,
)
from app.tasks.email_tasks import send_welcome_email_task
from app.services.member_service import (
    InvalidMemberRoleError,
    InvalidMemberStatusError,
    InvalidCurrentPasswordError,
    MemberAlreadyExistsError,
    MemberNotFoundError,
    approve_member,
    change_member_password,
    get_member_by_id,
    list_members_by_status,
    list_members_paginated,
    list_assignable_board_members,
    reject_member,
    update_member_board_role,
    update_member_position,
    update_member_profile,
)

router = APIRouter(prefix="/members", tags=["members"])


def _member_response(member: Member, viewer: Member) -> MemberResponse:
    return MemberResponse.from_member(member, viewer=viewer)


@router.get("/talent-options", response_model=MemberTalentOptionsResponse)
def list_talent_options(
    _: Member = Depends(get_current_member),
):
    return MemberTalentOptionsResponse(
        talents=[talent.value for talent in ALL_MEMBER_TALENTS],
        labels={talent.value: label for talent, label in MEMBER_TALENT_LABELS.items()},
    )


@router.get("", response_model=PaginatedMemberListResponse)
def list_members(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: MemberStatus | None = None,
    talents: list[str] | None = Query(default=None),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    if status is not None and not current_member.has_role_at_least(MemberRole.BOARD):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only board members can filter by status",
        )

    effective_status = status if status is not None else MemberStatus.APPROVED

    members, total = list_members_paginated(
        db,
        page=page,
        page_size=page_size,
        status=effective_status,
        talents=talents,
    )
    total_pages = math.ceil(total / page_size) if total else 0
    return PaginatedMemberListResponse(
        members=[_member_response(member, current_member) for member in members],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/me", response_model=MemberResponse)
def get_my_profile(current_member: Member = Depends(get_current_member)):
    return MemberResponse.from_member(current_member, viewer=current_member)


@router.patch("/me", response_model=MemberResponse)
def update_my_profile(
    data: MemberProfileUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        member = update_member_profile(db, current_member.id, data)
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.post("/me/password", response_model=TokenResponse)
def change_my_password(
    data: MemberPasswordChangeRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        change_member_password(
            db,
            current_member.id,
            current_password=data.current_password,
            new_password=data.new_password,
        )
    except InvalidCurrentPasswordError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    member = get_member_by_id(db, current_member.id)
    (
        access_token,
        expires_at,
        refresh_token,
        refresh_expires_at,
    ) = create_token_pair(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        refresh_expires_at=refresh_expires_at,
    )


@router.get("/assignees", response_model=MemberListResponse)
def list_assignable_members(
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = list_assignable_board_members(db)
    return MemberListResponse(
        members=[
            MemberResponse.from_member(member, viewer=current_member)
            for member in members
        ],
        total=len(members),
    )


@router.get("/pending", response_model=MemberListResponse)
def list_pending_members(
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = list_members_by_status(db, MemberStatus.PENDING)
    return MemberListResponse(
        members=[
            MemberResponse.from_member(member, viewer=current_member)
            for member in members
        ],
        total=len(members),
    )


@router.patch("/{member_id}/approve", response_model=MemberResponse)
def approve_member_endpoint(
    member_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = approve_member(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    send_welcome_email_task.delay(
        email=member.email,
        full_name=member.full_name,
    )

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/reject", response_model=MemberResponse)
def reject_member_endpoint(
    member_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = reject_member(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}", response_model=MemberResponse)
def update_member_profile_endpoint(
    member_id: int,
    data: MemberProfileUpdateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = update_member_profile(db, member_id, data)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/role", response_model=MemberResponse)
def update_member_role_endpoint(
    member_id: int,
    data: MemberBoardRoleUpdateRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    if member_id == current_member.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    try:
        member = update_member_board_role(db, member_id, data.role)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberRoleError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/position", response_model=MemberResponse)
def update_member_position_endpoint(
    member_id: int,
    data: MemberPositionUpdateRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    try:
        member = update_member_position(db, member_id, data.position)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberRoleError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.get("/{member_id}", response_model=MemberResponse)
def get_member_endpoint(
    member_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        member = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None

    if member.status != MemberStatus.APPROVED and not current_member.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return MemberResponse.from_member(member, viewer=current_member)
