"""Custom discussion room create / approve / reject / archive."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import member_has_role_at_least
from app.models.discussion_room import (
    MAX_DISCUSSION_ROOM_NAME_LENGTH,
    DiscussionRoom,
    DiscussionRoomKind,
    DiscussionRoomMember,
    DiscussionRoomMemberRole,
    DiscussionRoomStatus,
)
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.schemas.discussion_room import (
    DiscussionRoomMemberResponse,
    DiscussionRoomResponse,
)
from app.services.avatar_upload_service import (
    AvatarKind,
    delete_avatar_asset,
    upload_avatar_file,
)
from app.services.discussion_service import (
    DiscussionForbiddenError,
    DiscussionValidationError,
)
from app.services.discussion_ws_manager import custom_room_key
from app.services.organization_context import get_default_organization_id


class DiscussionRoomNotFoundError(Exception):
    pass


class DiscussionRoomInvalidStateError(Exception):
    pass


def can_review_discussion_rooms(member: Member) -> bool:
    return (
        member.role == MemberRole.PRESIDENT
        or member.position == MemberPosition.VICE_PRESIDENT
    )


def _room_href(room_id: int) -> str:
    return f"/discussions/room/{room_id}"


def dm_pair_key_for(member_a_id: int, member_b_id: int) -> str:
    low, high = sorted((member_a_id, member_b_id))
    return f"{low}:{high}"


def build_room_response(
    room: DiscussionRoom,
    *,
    viewer_id: int | None = None,
) -> DiscussionRoomResponse:
    members = sorted(
        room.members,
        key=lambda row: (
            0 if row.role == DiscussionRoomMemberRole.OWNER else 1,
            (row.member.full_name if row.member else "").lower(),
        ),
    )
    peer_member_id: int | None = None
    peer_full_name: str | None = None
    if room.kind == DiscussionRoomKind.DM and viewer_id is not None:
        for row in members:
            if row.member_id != viewer_id and row.member is not None:
                peer_member_id = row.member_id
                peer_full_name = row.member.full_name
                break

    return DiscussionRoomResponse(
        id=room.id,
        name=room.name,
        description=room.description,
        kind=room.kind,
        status=room.status,
        room_id=custom_room_key(room.id),
        href=_room_href(room.id),
        created_by_id=room.created_by_id,
        created_by_name=room.created_by.full_name if room.created_by else "Member",
        reviewed_by_id=room.reviewed_by_id,
        reviewed_by_name=room.reviewed_by.full_name if room.reviewed_by else None,
        review_note=room.review_note,
        created_at=room.created_at,
        reviewed_at=room.reviewed_at,
        members=[
            DiscussionRoomMemberResponse(
                member_id=row.member_id,
                full_name=row.member.full_name if row.member else "Member",
                role=row.role,
            )
            for row in members
            if row.member is not None
        ],
        peer_member_id=peer_member_id,
        peer_full_name=peer_full_name,
        avatar_url=room.avatar_url,
    )


def assert_can_manage_group_avatar(
    db: Session,
    *,
    room_id: int,
    member: Member,
) -> DiscussionRoom:
    """Owner or board+ may set avatars on group rooms (not DMs)."""
    room = assert_can_access_custom_room(db, room_id=room_id, member=member)
    if room.kind != DiscussionRoomKind.GROUP:
        raise DiscussionForbiddenError
    if room.status not in {
        DiscussionRoomStatus.LIVE,
        DiscussionRoomStatus.PENDING,
    }:
        raise DiscussionForbiddenError

    is_board = member_has_role_at_least(member, MemberRole.BOARD)
    is_owner = any(
        row.member_id == member.id and row.role == DiscussionRoomMemberRole.OWNER
        for row in room.members
    )
    if not (is_board or is_owner):
        raise DiscussionForbiddenError
    return room


def set_group_room_avatar(
    db: Session,
    *,
    room_id: int,
    actor: Member,
    file_bytes: bytes,
    content_type: str | None,
) -> DiscussionRoom:
    room = assert_can_manage_group_avatar(db, room_id=room_id, member=actor)
    previous_public_id = room.avatar_public_id

    upload_result = upload_avatar_file(
        kind=AvatarKind.GROUP,
        file_bytes=file_bytes,
        content_type=content_type,
    )
    room.avatar_url = upload_result.image_url
    room.avatar_public_id = upload_result.public_id
    db.commit()

    if previous_public_id and previous_public_id != upload_result.public_id:
        delete_avatar_asset(kind=AvatarKind.GROUP, public_id=previous_public_id)

    return _load_room(db, room.id)


def clear_group_room_avatar(
    db: Session,
    *,
    room_id: int,
    actor: Member,
) -> DiscussionRoom:
    room = assert_can_manage_group_avatar(db, room_id=room_id, member=actor)
    previous_public_id = room.avatar_public_id
    room.avatar_url = None
    room.avatar_public_id = None
    db.commit()

    delete_avatar_asset(kind=AvatarKind.GROUP, public_id=previous_public_id)
    return _load_room(db, room.id)


def _load_room(db: Session, room_id: int) -> DiscussionRoom:
    room = db.scalars(
        select(DiscussionRoom)
        .options(
            joinedload(DiscussionRoom.created_by),
            joinedload(DiscussionRoom.reviewed_by),
            joinedload(DiscussionRoom.members).joinedload(DiscussionRoomMember.member),
        )
        .where(DiscussionRoom.id == room_id)
    ).unique().first()
    if room is None:
        raise DiscussionRoomNotFoundError
    return room


def member_is_room_member(db: Session, *, room_id: int, member_id: int) -> bool:
    return (
        db.scalars(
            select(DiscussionRoomMember.id).where(
                DiscussionRoomMember.room_id == room_id,
                DiscussionRoomMember.member_id == member_id,
            )
        ).first()
        is not None
    )


def assert_can_access_custom_room(
    db: Session,
    *,
    room_id: int,
    member: Member,
    for_messaging: bool = False,
) -> DiscussionRoom:
    room = _load_room(db, room_id)

    # DMs are private: membership only (no Pres/VP oversight bypass).
    if room.kind == DiscussionRoomKind.DM:
        if not member_is_room_member(db, room_id=room.id, member_id=member.id):
            raise DiscussionForbiddenError
        if for_messaging and room.status != DiscussionRoomStatus.LIVE:
            raise DiscussionForbiddenError
        return room

    if room.status == DiscussionRoomStatus.ARCHIVED and for_messaging:
        raise DiscussionForbiddenError

    if room.status == DiscussionRoomStatus.LIVE:
        if member_is_room_member(db, room_id=room.id, member_id=member.id):
            return room
        if can_review_discussion_rooms(member):
            return room
        raise DiscussionForbiddenError

    if room.status == DiscussionRoomStatus.PENDING:
        if room.created_by_id == member.id or can_review_discussion_rooms(member):
            if for_messaging:
                raise DiscussionForbiddenError
            return room
        raise DiscussionForbiddenError

    # rejected / archived: creator + reviewers can view metadata
    if room.created_by_id == member.id or can_review_discussion_rooms(member):
        if for_messaging:
            raise DiscussionForbiddenError
        return room
    raise DiscussionForbiddenError


def create_discussion_room(
    db: Session,
    *,
    creator: Member,
    name: str,
    description: str | None,
    member_ids: list[int],
) -> DiscussionRoom:
    if not member_has_role_at_least(creator, MemberRole.BOARD):
        raise DiscussionForbiddenError

    cleaned_name = " ".join(name.split())
    if not cleaned_name:
        raise DiscussionValidationError("Room name is required")
    if len(cleaned_name) > MAX_DISCUSSION_ROOM_NAME_LENGTH:
        raise DiscussionValidationError(
            f"Room name must be at most {MAX_DISCUSSION_ROOM_NAME_LENGTH} characters"
        )

    auto_live = can_review_discussion_rooms(creator)
    status = (
        DiscussionRoomStatus.LIVE if auto_live else DiscussionRoomStatus.PENDING
    )
    now = datetime.now(UTC)

    room = DiscussionRoom(
        name=cleaned_name,
        description=description,
        kind=DiscussionRoomKind.GROUP,
        status=status,
        created_by_id=creator.id,
        reviewed_by_id=creator.id if auto_live else None,
        reviewed_at=now if auto_live else None,
        created_at=now,
        organization_id=get_default_organization_id(db),
    )
    db.add(room)
    db.flush()

    db.add(
        DiscussionRoomMember(
            room_id=room.id,
            member_id=creator.id,
            role=DiscussionRoomMemberRole.OWNER,
            added_by_id=creator.id,
        )
    )

    unique_ids = {
        member_id
        for member_id in member_ids
        if isinstance(member_id, int) and member_id > 0 and member_id != creator.id
    }
    if unique_ids:
        invited = list(
            db.scalars(
                select(Member).where(
                    Member.id.in_(unique_ids),
                    Member.status == MemberStatus.APPROVED,
                )
            ).all()
        )
        for invitee in invited:
            db.add(
                DiscussionRoomMember(
                    room_id=room.id,
                    member_id=invitee.id,
                    role=DiscussionRoomMemberRole.MEMBER,
                    added_by_id=creator.id,
                )
            )

    db.commit()
    return _load_room(db, room.id)


def get_or_create_dm(
    db: Session,
    *,
    actor: Member,
    target_member_id: int,
) -> DiscussionRoom:
    """Find or create a private live 1:1 DM between two approved members."""
    if not actor.is_approved:
        raise DiscussionForbiddenError
    if target_member_id == actor.id:
        raise DiscussionValidationError("You cannot message yourself")

    target = db.scalars(
        select(Member).where(Member.id == target_member_id)
    ).first()
    if target is None or not target.is_approved:
        raise DiscussionValidationError("Member not found")
    # Same campus only — null/mismatched university_id is denied.
    if actor.university_id != target.university_id:
        raise DiscussionForbiddenError

    org_id = get_default_organization_id(db)
    pair_key = dm_pair_key_for(actor.id, target.id)

    def _find_existing() -> DiscussionRoom | None:
        return (
            db.scalars(
                select(DiscussionRoom)
                .options(
                    joinedload(DiscussionRoom.created_by),
                    joinedload(DiscussionRoom.reviewed_by),
                    joinedload(DiscussionRoom.members).joinedload(
                        DiscussionRoomMember.member
                    ),
                )
                .where(
                    DiscussionRoom.organization_id == org_id,
                    DiscussionRoom.kind == DiscussionRoomKind.DM,
                    DiscussionRoom.dm_pair_key == pair_key,
                )
            )
            .unique()
            .first()
        )

    existing = _find_existing()
    if existing is not None:
        return existing

    now = datetime.now(UTC)
    peer_label = (target.full_name or "Member").strip() or "Member"
    room = DiscussionRoom(
        name=f"DM · {peer_label}"[:MAX_DISCUSSION_ROOM_NAME_LENGTH],
        description=None,
        kind=DiscussionRoomKind.DM,
        dm_pair_key=pair_key,
        status=DiscussionRoomStatus.LIVE,
        created_by_id=actor.id,
        reviewed_by_id=actor.id,
        reviewed_at=now,
        created_at=now,
        organization_id=org_id,
    )
    db.add(room)
    try:
        db.flush()
        db.add(
            DiscussionRoomMember(
                room_id=room.id,
                member_id=actor.id,
                role=DiscussionRoomMemberRole.OWNER,
                added_by_id=actor.id,
            )
        )
        db.add(
            DiscussionRoomMember(
                room_id=room.id,
                member_id=target.id,
                role=DiscussionRoomMemberRole.MEMBER,
                added_by_id=actor.id,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raced = _find_existing()
        if raced is not None:
            return raced
        raise
    return _load_room(db, room.id)


def list_pending_discussion_rooms(db: Session) -> list[DiscussionRoom]:
    return list(
        db.scalars(
            select(DiscussionRoom)
            .options(
                joinedload(DiscussionRoom.created_by),
                joinedload(DiscussionRoom.reviewed_by),
                joinedload(DiscussionRoom.members).joinedload(
                    DiscussionRoomMember.member
                ),
            )
            .where(
                DiscussionRoom.status == DiscussionRoomStatus.PENDING,
                DiscussionRoom.kind == DiscussionRoomKind.GROUP,
                DiscussionRoom.organization_id == get_default_organization_id(db),
            )
            .order_by(DiscussionRoom.created_at.asc())
        ).unique().all()
    )


def list_my_discussion_rooms(db: Session, *, member: Member) -> list[DiscussionRoom]:
    """Rooms the member created (any status) or belongs to while live."""
    org_id = get_default_organization_id(db)
    membership_room_ids = set(
        db.scalars(
            select(DiscussionRoomMember.room_id).where(
                DiscussionRoomMember.member_id == member.id
            )
        ).all()
    )
    if not membership_room_ids and not can_review_discussion_rooms(member):
        created = list(
            db.scalars(
                select(DiscussionRoom)
                .options(
                    joinedload(DiscussionRoom.created_by),
                    joinedload(DiscussionRoom.reviewed_by),
                    joinedload(DiscussionRoom.members).joinedload(
                        DiscussionRoomMember.member
                    ),
                )
                .where(
                    DiscussionRoom.created_by_id == member.id,
                    DiscussionRoom.organization_id == org_id,
                )
                .order_by(DiscussionRoom.created_at.desc())
            ).unique().all()
        )
        return created

    rooms = list(
        db.scalars(
            select(DiscussionRoom)
            .options(
                joinedload(DiscussionRoom.created_by),
                joinedload(DiscussionRoom.reviewed_by),
                joinedload(DiscussionRoom.members).joinedload(
                    DiscussionRoomMember.member
                ),
            )
            .where(
                (
                    (DiscussionRoom.created_by_id == member.id)
                    | (DiscussionRoom.id.in_(membership_room_ids))
                ),
                DiscussionRoom.organization_id == org_id,
            )
            .order_by(DiscussionRoom.created_at.desc())
        ).unique().all()
    )
    return [
        room
        for room in rooms
        if room.status
        in {
            DiscussionRoomStatus.PENDING,
            DiscussionRoomStatus.LIVE,
            DiscussionRoomStatus.REJECTED,
            DiscussionRoomStatus.ARCHIVED,
        }
    ]


def approve_discussion_room(
    db: Session,
    *,
    room_id: int,
    reviewer: Member,
) -> DiscussionRoom:
    if not can_review_discussion_rooms(reviewer):
        raise DiscussionForbiddenError

    room = _load_room(db, room_id)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError("Direct messages cannot be reviewed")
    if room.status != DiscussionRoomStatus.PENDING:
        raise DiscussionRoomInvalidStateError("Only pending rooms can be approved")

    room.status = DiscussionRoomStatus.LIVE
    room.reviewed_by_id = reviewer.id
    room.reviewed_at = datetime.now(UTC)
    room.review_note = None
    db.commit()
    return _load_room(db, room_id)


def reject_discussion_room(
    db: Session,
    *,
    room_id: int,
    reviewer: Member,
    review_note: str | None,
) -> DiscussionRoom:
    if not can_review_discussion_rooms(reviewer):
        raise DiscussionForbiddenError

    room = _load_room(db, room_id)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError("Direct messages cannot be reviewed")
    if room.status != DiscussionRoomStatus.PENDING:
        raise DiscussionRoomInvalidStateError("Only pending rooms can be rejected")

    room.status = DiscussionRoomStatus.REJECTED
    room.reviewed_by_id = reviewer.id
    room.reviewed_at = datetime.now(UTC)
    room.review_note = review_note
    db.commit()
    return _load_room(db, room_id)


def archive_discussion_room(
    db: Session,
    *,
    room_id: int,
    actor: Member,
) -> DiscussionRoom:
    if not can_review_discussion_rooms(actor):
        raise DiscussionForbiddenError

    room = _load_room(db, room_id)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError("Direct messages cannot be archived here")
    if room.status not in {DiscussionRoomStatus.LIVE, DiscussionRoomStatus.PENDING}:
        raise DiscussionRoomInvalidStateError("Only live or pending rooms can be archived")

    room.status = DiscussionRoomStatus.ARCHIVED
    room.reviewed_by_id = actor.id
    room.reviewed_at = datetime.now(UTC)
    db.commit()
    return _load_room(db, room_id)


def unarchive_discussion_room(
    db: Session,
    *,
    room_id: int,
    actor: Member,
) -> DiscussionRoom:
    if not can_review_discussion_rooms(actor):
        raise DiscussionForbiddenError

    room = _load_room(db, room_id)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError("Direct messages cannot be restored here")
    if room.status != DiscussionRoomStatus.ARCHIVED:
        raise DiscussionRoomInvalidStateError("Only archived rooms can be restored")

    room.status = DiscussionRoomStatus.LIVE
    room.reviewed_by_id = actor.id
    room.reviewed_at = datetime.now(UTC)
    room.review_note = None
    db.commit()
    return _load_room(db, room_id)


def _actor_can_manage_room_members(
    db: Session,
    *,
    room: DiscussionRoom,
    actor: Member,
) -> bool:
    if room.kind != DiscussionRoomKind.GROUP:
        return False
    if member_has_role_at_least(actor, MemberRole.BOARD):
        return True
    membership = next(
        (row for row in room.members if row.member_id == actor.id),
        None,
    )
    return membership is not None and membership.role == DiscussionRoomMemberRole.OWNER


def add_members_to_discussion_room(
    db: Session,
    *,
    room_id: int,
    actor: Member,
    member_ids: list[int],
) -> DiscussionRoom:
    room = assert_can_access_custom_room(db, room_id=room_id, member=actor)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError("Cannot add members to a direct message")
    if room.status == DiscussionRoomStatus.ARCHIVED:
        raise DiscussionRoomInvalidStateError("Cannot add members to an archived room")
    if not _actor_can_manage_room_members(db, room=room, actor=actor):
        raise DiscussionForbiddenError

    existing = {row.member_id for row in room.members}
    unique_ids = {
        member_id
        for member_id in member_ids
        if isinstance(member_id, int) and member_id > 0 and member_id not in existing
    }
    if not unique_ids:
        return room

    invited = list(
        db.scalars(
            select(Member).where(
                Member.id.in_(unique_ids),
                Member.status == MemberStatus.APPROVED,
            )
        ).all()
    )
    if not invited:
        raise DiscussionValidationError("No approved members found to add")

    for invitee in invited:
        db.add(
            DiscussionRoomMember(
                room_id=room.id,
                member_id=invitee.id,
                role=DiscussionRoomMemberRole.MEMBER,
                added_by_id=actor.id,
            )
        )
    db.commit()
    return _load_room(db, room.id)


def remove_member_from_discussion_room(
    db: Session,
    *,
    room_id: int,
    actor: Member,
    member_id: int,
) -> DiscussionRoom:
    room = assert_can_access_custom_room(db, room_id=room_id, member=actor)
    if room.kind == DiscussionRoomKind.DM:
        raise DiscussionRoomInvalidStateError(
            "Cannot remove members from a direct message"
        )
    if not _actor_can_manage_room_members(db, room=room, actor=actor):
        raise DiscussionForbiddenError

    target = next((row for row in room.members if row.member_id == member_id), None)
    if target is None:
        raise DiscussionValidationError("Member is not in this room")
    if target.role == DiscussionRoomMemberRole.OWNER:
        raise DiscussionValidationError("Cannot remove the room owner")
    if member_id == actor.id:
        raise DiscussionValidationError("Use leave instead of removing yourself")

    db.delete(target)
    db.commit()
    return _load_room(db, room.id)


def list_archived_custom_rooms(db: Session) -> list[DiscussionRoom]:
    return list(
        db.scalars(
            select(DiscussionRoom)
            .options(
                joinedload(DiscussionRoom.created_by),
                joinedload(DiscussionRoom.reviewed_by),
                joinedload(DiscussionRoom.members).joinedload(
                    DiscussionRoomMember.member
                ),
            )
            .where(
                DiscussionRoom.status == DiscussionRoomStatus.ARCHIVED,
                DiscussionRoom.kind == DiscussionRoomKind.GROUP,
                DiscussionRoom.organization_id == get_default_organization_id(db),
            )
            .order_by(DiscussionRoom.reviewed_at.desc().nulls_last())
        ).unique().all()
    )


def list_live_rooms_for_member(db: Session, *, member: Member) -> list[DiscussionRoom]:
    room_ids = list(
        db.scalars(
            select(DiscussionRoomMember.room_id).where(
                DiscussionRoomMember.member_id == member.id
            )
        ).all()
    )
    if not room_ids:
        return []
    return list(
        db.scalars(
            select(DiscussionRoom)
            .options(
                joinedload(DiscussionRoom.created_by),
                joinedload(DiscussionRoom.members).joinedload(
                    DiscussionRoomMember.member
                ),
            )
            .where(
                DiscussionRoom.id.in_(room_ids),
                DiscussionRoom.status == DiscussionRoomStatus.LIVE,
                DiscussionRoom.organization_id == get_default_organization_id(db),
            )
        ).unique().all()
    )
