import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.custom_board_position import CustomBoardPosition
from app.models.member import Member, MemberPosition
from app.schemas.custom_board_position import (
    BuiltInBoardPositionResponse,
    CustomBoardPositionHolderSummary,
    CustomBoardPositionResponse,
    MemberPositionCatalogResponse,
)

BUILT_IN_POSITION_LABELS: dict[MemberPosition, str] = {
    MemberPosition.PRESIDENT: "President",
    MemberPosition.VICE_PRESIDENT: "Vice President",
    MemberPosition.SECRETARY: "Secretary",
    MemberPosition.TREASURER: "Treasurer",
    MemberPosition.EVENT_MANAGER: "Event Manager",
    MemberPosition.PUBLIC_RELATIONS_OFFICER: "Public Relations Officer",
    MemberPosition.NEW_STUDENT_REPRESENTATIVE: "New Student Representative",
    MemberPosition.MEMBER: "Member",
}


def normalize_position_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


RESERVED_POSITION_NAMES = frozenset(
    normalize_position_name(label) for label in BUILT_IN_POSITION_LABELS.values()
) | frozenset(
    normalize_position_name(position.value.replace("_", " "))
    for position in MemberPosition
)


class CustomBoardPositionNotFoundError(Exception):
    pass


class CustomBoardPositionValidationError(Exception):
    pass


class CustomBoardPositionConflictError(Exception):
    pass


def to_custom_board_position_response(
    position: CustomBoardPosition,
) -> CustomBoardPositionResponse:
    holder = None
    if position.holder is not None:
        holder = CustomBoardPositionHolderSummary(
            id=position.holder.id,
            full_name=position.holder.full_name,
        )
    return CustomBoardPositionResponse(
        id=position.id,
        name=position.name,
        is_active=position.is_active,
        created_by_id=position.created_by_id,
        created_at=position.created_at,
        updated_at=position.updated_at,
        archived_at=position.archived_at,
        holder=holder,
    )


def _validate_name(name: str) -> tuple[str, str]:
    cleaned = " ".join(name.split())
    normalized = normalize_position_name(cleaned)
    if not normalized:
        raise CustomBoardPositionValidationError("Name is required")
    if normalized in RESERVED_POSITION_NAMES:
        raise CustomBoardPositionValidationError(
            "This name is reserved for a built-in board position",
        )
    return cleaned, normalized


def get_custom_board_position(
    db: Session,
    position_id: int,
    *,
    include_archived: bool = True,
) -> CustomBoardPosition:
    position = db.scalar(
        select(CustomBoardPosition)
        .options(joinedload(CustomBoardPosition.holder))
        .where(CustomBoardPosition.id == position_id),
    )
    if position is None:
        raise CustomBoardPositionNotFoundError
    if not include_archived and not position.is_active:
        raise CustomBoardPositionNotFoundError
    return position


def list_custom_board_positions(
    db: Session,
    *,
    include_archived: bool = False,
) -> list[CustomBoardPosition]:
    query = select(CustomBoardPosition).options(
        joinedload(CustomBoardPosition.holder),
    )
    if not include_archived:
        query = query.where(CustomBoardPosition.is_active.is_(True))
    query = query.order_by(CustomBoardPosition.name.asc())
    return list(db.scalars(query).unique().all())


def get_member_position_catalog(
    db: Session,
    *,
    include_archived: bool = False,
) -> MemberPositionCatalogResponse:
    built_in = [
        BuiltInBoardPositionResponse(
            key=position,
            label=BUILT_IN_POSITION_LABELS[position],
        )
        for position in MemberPosition
        if position != MemberPosition.MEMBER
    ]
    built_in.append(
        BuiltInBoardPositionResponse(
            key=MemberPosition.MEMBER,
            label=BUILT_IN_POSITION_LABELS[MemberPosition.MEMBER],
        ),
    )
    custom = [
        to_custom_board_position_response(position)
        for position in list_custom_board_positions(
            db,
            include_archived=include_archived,
        )
    ]
    return MemberPositionCatalogResponse(built_in=built_in, custom=custom)


def create_custom_board_position(
    db: Session,
    *,
    name: str,
    created_by: Member,
) -> CustomBoardPosition:
    cleaned, normalized = _validate_name(name)
    existing = db.scalar(
        select(CustomBoardPosition).where(
            CustomBoardPosition.name_normalized == normalized,
        ),
    )
    if existing is not None:
        raise CustomBoardPositionConflictError(
            "A custom board position with this name already exists",
        )

    position = CustomBoardPosition(
        name=cleaned,
        name_normalized=normalized,
        is_active=True,
        created_by_id=created_by.id,
    )
    db.add(position)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CustomBoardPositionConflictError(
            "A custom board position with this name already exists",
        ) from exc
    db.refresh(position)
    return get_custom_board_position(db, position.id)


def rename_custom_board_position(
    db: Session,
    position_id: int,
    *,
    name: str,
) -> CustomBoardPosition:
    position = get_custom_board_position(db, position_id)
    cleaned, normalized = _validate_name(name)

    duplicate = db.scalar(
        select(CustomBoardPosition).where(
            CustomBoardPosition.name_normalized == normalized,
            CustomBoardPosition.id != position_id,
        ),
    )
    if duplicate is not None:
        raise CustomBoardPositionConflictError(
            "A custom board position with this name already exists",
        )

    position.name = cleaned
    position.name_normalized = normalized
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CustomBoardPositionConflictError(
            "A custom board position with this name already exists",
        ) from exc
    db.refresh(position)
    return get_custom_board_position(db, position.id)


def archive_custom_board_position(
    db: Session,
    position_id: int,
) -> CustomBoardPosition:
    position = get_custom_board_position(db, position_id)
    if not position.is_active:
        return position

    position.is_active = False
    position.archived_at = datetime.now(UTC)
    db.commit()
    db.refresh(position)
    return get_custom_board_position(db, position.id)


def list_custom_position_responses(
    db: Session,
    *,
    include_archived: bool = False,
) -> list[CustomBoardPositionResponse]:
    return [
        to_custom_board_position_response(position)
        for position in list_custom_board_positions(
            db,
            include_archived=include_archived,
        )
    ]

