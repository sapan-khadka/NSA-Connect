from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.member import (
    EXCLUSIVE_AUTH_ROLES,
    EXCLUSIVE_MEMBER_POSITIONS,
    Member,
    MemberPosition,
    MemberRole,
    MemberStatus,
    POSITION_AUTH_ROLES,
)
from app.schemas.member import MemberCreateRequest, MemberProfileUpdateRequest


class MemberAlreadyExistsError(Exception):
    pass


class StudentIdAlreadyExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class MemberNotApprovedError(Exception):
    pass


class MemberNotFoundError(Exception):
    pass


class InvalidMemberStatusError(Exception):
    pass


class InvalidMemberRoleError(Exception):
    pass


class InvalidCurrentPasswordError(Exception):
    pass


def create_member(db: Session, data: MemberCreateRequest) -> Member:
    existing = db.scalar(select(Member).where(Member.email == data.email))
    if existing:
        raise MemberAlreadyExistsError

    existing_student_id = db.scalar(
        select(Member).where(Member.student_id == data.student_id)
    )
    if existing_student_id:
        raise StudentIdAlreadyExistsError

    member = Member(
        full_name=data.full_name,
        email=data.email,
        student_id=data.student_id,
        major=data.major,
        graduation_year=data.graduation_year,
        hashed_password=hash_password(data.password),
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def authenticate_member(db: Session, email: str, password: str) -> Member:
    member = db.scalar(select(Member).where(Member.email == email))

    if member is None or not verify_password(password, member.hashed_password):
        raise InvalidCredentialsError

    if not member.can_authenticate():
        raise MemberNotApprovedError

    return member


def get_member_by_id(db: Session, member_id: int) -> Member:
    member = db.get(Member, member_id)
    if member is None:
        raise MemberNotFoundError
    return member


def list_members_by_status(db: Session, status: MemberStatus | None = None) -> list[Member]:
    query = select(Member)
    if status is not None:
        query = query.where(Member.status == status)
    return list(db.scalars(query.order_by(Member.id)).all())


def list_members_paginated(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    status: MemberStatus | None = None,
) -> tuple[list[Member], int]:
    filters = []
    if status is not None:
        filters.append(Member.status == status)

    total = db.scalar(select(func.count()).select_from(Member).where(*filters)) or 0
    offset = (page - 1) * page_size
    members = list(
        db.scalars(
            select(Member)
            .where(*filters)
            .order_by(Member.id)
            .offset(offset)
            .limit(page_size)
        ).all()
    )
    return members, total


def list_assignable_board_members(db: Session) -> list[Member]:
    return list(
        db.scalars(
            select(Member)
            .where(Member.status == MemberStatus.APPROVED)
            .where(
                Member.role.in_(
                    [MemberRole.BOARD, MemberRole.TREASURER, MemberRole.PRESIDENT],
                ),
            )
            .order_by(Member.full_name.asc()),
        ).all(),
    )


def approve_member(db: Session, member_id: int) -> Member:
    member = get_member_by_id(db, member_id)
    if member.status != MemberStatus.PENDING:
        raise InvalidMemberStatusError("Only pending members can be approved")
    member.status = MemberStatus.APPROVED
    db.commit()
    db.refresh(member)
    return member


def reject_member(db: Session, member_id: int) -> Member:
    member = get_member_by_id(db, member_id)
    if member.status != MemberStatus.PENDING:
        raise InvalidMemberStatusError("Only pending members can be rejected")
    member.status = MemberStatus.REJECTED
    db.commit()
    db.refresh(member)
    return member


def update_member_board_role(db: Session, member_id: int, role: MemberRole) -> Member:
    member = get_member_by_id(db, member_id)

    if not member.is_approved:
        raise InvalidMemberRoleError("Only approved members can have their role updated")

    if role not in (MemberRole.BOARD, MemberRole.GENERAL):
        raise InvalidMemberRoleError(
            "Only board and general roles can be assigned through this endpoint"
        )

    if member.role in (MemberRole.PRESIDENT, MemberRole.TREASURER):
        raise InvalidMemberRoleError("Cannot change role of president or treasurer members")

    if role == member.role:
        raise InvalidMemberRoleError("Member already has this role")

    if role == MemberRole.BOARD and member.role != MemberRole.GENERAL:
        raise InvalidMemberRoleError("Only general members can be promoted to board")

    if role == MemberRole.GENERAL and member.role != MemberRole.BOARD:
        raise InvalidMemberRoleError("Only board members can be demoted to general")

    member.role = role
    db.commit()
    db.refresh(member)
    return member


def _clear_exclusive_position_holder(
    db: Session,
    position: MemberPosition,
    except_member_id: int,
) -> None:
    if position not in EXCLUSIVE_MEMBER_POSITIONS:
        return

    previous_holder = db.scalar(
        select(Member).where(
            Member.position == position,
            Member.id != except_member_id,
        ),
    )
    if previous_holder is not None:
        previous_holder.position = MemberPosition.MEMBER
        _sync_auth_role_from_position(previous_holder)


def _clear_exclusive_auth_role_holder(
    db: Session,
    role: MemberRole,
    except_member_id: int,
) -> None:
    if role not in EXCLUSIVE_AUTH_ROLES:
        return

    previous_holders = db.scalars(
        select(Member).where(
            Member.role == role,
            Member.id != except_member_id,
        ),
    ).all()
    for previous_holder in previous_holders:
        previous_holder.role = MemberRole.BOARD
        if previous_holder.position in POSITION_AUTH_ROLES:
            previous_holder.position = MemberPosition.MEMBER


def _sync_auth_role_from_position(member: Member) -> None:
    mapped_role = POSITION_AUTH_ROLES.get(member.position)
    if mapped_role is not None:
        member.role = mapped_role
        return

    if member.role in EXCLUSIVE_AUTH_ROLES:
        member.role = MemberRole.BOARD
        return

    if (
        member.role == MemberRole.GENERAL
        and member.position in EXCLUSIVE_MEMBER_POSITIONS
    ):
        member.role = MemberRole.BOARD


def update_member_position(
    db: Session,
    member_id: int,
    position: MemberPosition,
) -> Member:
    member = get_member_by_id(db, member_id)

    if not member.is_approved:
        raise InvalidMemberRoleError(
            "Only approved members can have their position updated",
        )

    if position != member.position:
        _clear_exclusive_position_holder(db, position, member_id)
        mapped_role = POSITION_AUTH_ROLES.get(position)
        if mapped_role is not None:
            _clear_exclusive_auth_role_holder(db, mapped_role, member_id)
        member.position = position
        _sync_auth_role_from_position(member)
        db.commit()
        db.refresh(member)

    return member


def update_member_profile(
    db: Session,
    member_id: int,
    data: MemberProfileUpdateRequest,
) -> Member:
    member = get_member_by_id(db, member_id)

    if data.email is not None and data.email != member.email:
        existing = db.scalar(select(Member).where(Member.email == data.email))
        if existing is not None:
            raise MemberAlreadyExistsError
        member.email = data.email

    if data.full_name is not None:
        member.full_name = data.full_name

    if data.major is not None:
        member.major = data.major

    if data.graduation_year is not None:
        member.graduation_year = data.graduation_year

    db.commit()
    db.refresh(member)
    return member


def change_member_password(
    db: Session,
    member_id: int,
    *,
    current_password: str,
    new_password: str,
) -> None:
    member = get_member_by_id(db, member_id)

    if not verify_password(current_password, member.hashed_password):
        raise InvalidCurrentPasswordError

    member.hashed_password = hash_password(new_password)
    db.commit()
