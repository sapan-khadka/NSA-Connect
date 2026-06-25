import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board, require_president
from app.models.member import Member, MemberStatus
from app.schemas.member import (
    MemberBoardRoleUpdateRequest,
    MemberListResponse,
    MemberProfileUpdateRequest,
    MemberResponse,
    PaginatedMemberListResponse,
)
from app.tasks.email_tasks import send_welcome_email_task
from app.services.member_service import (
    InvalidMemberRoleError,
    InvalidMemberStatusError,
    MemberAlreadyExistsError,
    MemberNotFoundError,
    approve_member,
    list_members_by_status,
    list_members_paginated,
    list_assignable_board_members,
    reject_member,
    update_member_board_role,
    update_member_profile,
)

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=PaginatedMemberListResponse)
def list_members(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: MemberStatus | None = None,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members, total = list_members_paginated(
        db,
        page=page,
        page_size=page_size,
        status=status,
    )
    total_pages = math.ceil(total / page_size) if total else 0
    return PaginatedMemberListResponse(
        members=[MemberResponse.from_member(member) for member in members],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/me", response_model=MemberResponse)
def get_my_profile(current_member: Member = Depends(get_current_member)):
    return MemberResponse.from_member(current_member)


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

    return MemberResponse.from_member(member)


@router.get("/assignees", response_model=MemberListResponse)
def list_assignable_members(
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = list_assignable_board_members(db)
    return MemberListResponse(
        members=[MemberResponse.from_member(member) for member in members],
        total=len(members),
    )


@router.get("/pending", response_model=MemberListResponse)
def list_pending_members(
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = list_members_by_status(db, MemberStatus.PENDING)
    return MemberListResponse(
        members=[MemberResponse.from_member(member) for member in members],
        total=len(members),
    )


@router.patch("/{member_id}/approve", response_model=MemberResponse)
def approve_member_endpoint(
    member_id: int,
    _: Member = Depends(require_board),
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

    return MemberResponse.from_member(member)


@router.patch("/{member_id}/reject", response_model=MemberResponse)
def reject_member_endpoint(
    member_id: int,
    _: Member = Depends(require_board),
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

    return MemberResponse.from_member(member)


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

    return MemberResponse.from_member(member)

# TODO: GET /{member_id} — get member profile
