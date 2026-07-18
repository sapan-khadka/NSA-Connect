from decimal import Decimal
from io import StringIO
import csv
import secrets

from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.core.password_validation import validate_password_strength
from app.core.security import hash_password, verify_password
from app.lib.member_majors import normalize_major
from app.models.member import (
    EXCLUSIVE_AUTH_ROLES,
    EXCLUSIVE_MEMBER_POSITIONS,
    POSITION_AUTH_ROLES,
    Member,
    MemberPosition,
    MemberRole,
    MemberStatus,
)
from app.models.member_dues import DuesStatus, MemberDues
from app.schemas.member import (
    MemberCreateRequest,
    MemberInviteRequest,
    MemberProfileUpdateRequest,
)


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


def _check_member_identity_uniqueness(
    db: Session,
    *,
    email: str,
    student_id: str,
) -> None:
    if db.scalar(select(Member).where(Member.email == email)):
        raise MemberAlreadyExistsError
    if db.scalar(select(Member).where(Member.student_id == student_id)):
        raise StudentIdAlreadyExistsError


def create_member(db: Session, data: MemberCreateRequest) -> Member:
    _check_member_identity_uniqueness(
        db,
        email=data.email,
        student_id=data.student_id,
    )

    validate_password_strength(
        data.password,
        email=data.email,
        full_name=data.full_name,
    )

    member = Member(
        full_name=data.full_name,
        email=data.email,
        student_id=data.student_id,
        major=normalize_major(data.major),
        graduation_year=data.graduation_year,
        hashed_password=hash_password(data.password),
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
        talents=[],
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def create_invited_member(
    db: Session,
    data: MemberInviteRequest,
    *,
    commit: bool = True,
) -> Member:
    """Create an approved member with an unusable password hash.

    Single-invite uses commit=True (default). Bulk import uses commit=False so
    the caller can flush many rows and checkpoint in chunks.
    """
    # One-row path keeps friendly duplicate checks. Bulk import already checked
    # identities via upfront + seen sets and must not query once per row.
    if commit:
        _check_member_identity_uniqueness(
            db,
            email=data.email,
            student_id=data.student_id,
        )

    unusable_secret = secrets.token_urlsafe(48)
    member = Member(
        full_name=data.full_name.strip(),
        email=data.email,
        student_id=data.student_id,
        major=normalize_major(data.major),
        graduation_year=data.graduation_year,
        phone=data.phone.strip() if data.phone else None,
        hashed_password=hash_password(unusable_secret),
        role=MemberRole.GENERAL,
        position=MemberPosition.MEMBER,
        status=MemberStatus.APPROVED,
        talents=[],
    )
    db.add(member)
    if commit:
        db.commit()
        db.refresh(member)
    else:
        db.flush()
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


def list_members_by_status(
    db: Session, status: MemberStatus | None = None
) -> list[Member]:
    query = select(Member)
    if status is not None:
        query = query.where(Member.status == status)
    return list(db.scalars(query.order_by(Member.id)).all())


def _member_has_talent_filters(db: Session, talents: list[str]):
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        return [cast(Member.talents, JSONB).contains([talent]) for talent in talents]
    return [Member.talents.contains([talent]) for talent in talents]


def list_members_paginated(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    status: MemberStatus | None = None,
    talents: list[str] | None = None,
) -> tuple[list[Member], int]:
    filters = []
    if status is not None:
        filters.append(Member.status == status)

    if talents:
        talent_filters = _member_has_talent_filters(db, talents)
        filters.append(or_(*talent_filters))

    total = db.scalar(select(func.count()).select_from(Member).where(*filters)) or 0
    offset = (page - 1) * page_size
    members = list(
        db.scalars(
            select(Member)
            .where(*filters)
            .order_by(Member.full_name.asc(), Member.id.asc())
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


def list_assignable_approved_members(db: Session) -> list[Member]:
    """All approved members — used for simple EventTask assignee pickers."""
    return list(
        db.scalars(
            select(Member)
            .where(Member.status == MemberStatus.APPROVED)
            .order_by(Member.full_name.asc()),
        ).all(),
    )


def build_members_export_csv(db: Session, *, semester: str) -> str:
    """CSV of all members with current-semester outstanding dues."""
    members = list(
        db.scalars(select(Member).order_by(Member.full_name.asc())).all(),
    )
    dues_rows = list(
        db.scalars(select(MemberDues).where(MemberDues.semester == semester)).all(),
    )
    dues_by_member_id = {row.member_id: row for row in dues_rows}

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "name",
            "email",
            "role",
            "status",
            "graduation_year",
            "outstanding_dues",
        ],
    )

    for member in members:
        dues = dues_by_member_id.get(member.id)
        outstanding = ""
        if dues is not None:
            dues_status = MemberDues.compute_status(
                dues.amount_owed,
                dues.amount_paid,
            )
            if dues_status != DuesStatus.EXEMPT:
                owed = Decimal(str(dues.amount_owed))
                paid = Decimal(str(dues.amount_paid))
                outstanding = f"{max(owed - paid, Decimal('0')):.2f}"
            else:
                outstanding = "0.00"

        writer.writerow(
            [
                member.full_name,
                member.email,
                member.role.value if hasattr(member.role, "value") else member.role,
                member.status.value if hasattr(member.status, "value") else member.status,
                member.graduation_year,
                outstanding,
            ],
        )

    return output.getvalue()


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
    member.token_version = (member.token_version or 1) + 1
    db.commit()
    db.refresh(member)
    return member


def update_member_board_role(db: Session, member_id: int, role: MemberRole) -> Member:
    member = get_member_by_id(db, member_id)

    if not member.is_approved:
        raise InvalidMemberRoleError(
            "Only approved members can have their role updated"
        )

    if role not in (MemberRole.BOARD, MemberRole.GENERAL):
        raise InvalidMemberRoleError(
            "Only board and general roles can be assigned through this endpoint"
        )

    if member.role in (MemberRole.PRESIDENT, MemberRole.TREASURER):
        raise InvalidMemberRoleError(
            "Cannot change role of president or treasurer members"
        )

    if role == member.role:
        raise InvalidMemberRoleError("Member already has this role")

    if role == MemberRole.BOARD and member.role != MemberRole.GENERAL:
        raise InvalidMemberRoleError("Only general members can be promoted to board")

    if role == MemberRole.GENERAL and member.role != MemberRole.BOARD:
        raise InvalidMemberRoleError("Only board members can be demoted to general")

    if role == MemberRole.GENERAL and member.role != MemberRole.GENERAL:
        if member.position in EXCLUSIVE_MEMBER_POSITIONS:
            member.position = MemberPosition.MEMBER

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
        member.major = normalize_major(data.major)

    if data.graduation_year is not None:
        member.graduation_year = data.graduation_year

    if data.interests is not None:
        member.interests = data.interests

    if data.bio is not None:
        member.bio = data.bio

    if data.talents is not None:
        member.talents = data.talents
        if "other" not in data.talents:
            member.talent_other = None

    if data.talent_other is not None:
        member.talent_other = data.talent_other

    if data.phone is not None:
        member.phone = data.phone

    if data.social_handle is not None:
        member.social_handle = data.social_handle

    if data.email_visibility is not None:
        member.email_visibility = data.email_visibility

    if data.phone_visibility is not None:
        member.phone_visibility = data.phone_visibility

    if data.social_handle_visibility is not None:
        member.social_handle_visibility = data.social_handle_visibility

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

    validate_password_strength(
        new_password,
        email=member.email,
        full_name=member.full_name,
    )

    member.hashed_password = hash_password(new_password)
    member.token_version = (member.token_version or 1) + 1
    db.commit()
