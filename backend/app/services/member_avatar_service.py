"""Self-service member profile avatar upload/delete."""

from sqlalchemy.orm import Session

from app.models.member import Member
from app.services.avatar_upload_service import (
    AvatarKind,
    delete_avatar_asset,
    upload_avatar_file,
)
from app.services.member_service import MemberNotFoundError, get_member_by_id


def set_member_avatar(
    db: Session,
    member_id: int,
    *,
    file_bytes: bytes,
    content_type: str | None,
) -> Member:
    member = get_member_by_id(db, member_id)
    previous_public_id = member.avatar_public_id

    upload_result = upload_avatar_file(
        kind=AvatarKind.MEMBER,
        file_bytes=file_bytes,
        content_type=content_type,
    )

    member.avatar_url = upload_result.image_url
    member.avatar_public_id = upload_result.public_id
    db.commit()
    db.refresh(member)

    if previous_public_id and previous_public_id != upload_result.public_id:
        delete_avatar_asset(kind=AvatarKind.MEMBER, public_id=previous_public_id)

    return member


def clear_member_avatar(db: Session, member_id: int) -> Member:
    member = get_member_by_id(db, member_id)
    previous_public_id = member.avatar_public_id
    member.avatar_url = None
    member.avatar_public_id = None
    db.commit()
    db.refresh(member)

    delete_avatar_asset(kind=AvatarKind.MEMBER, public_id=previous_public_id)
    return member


__all__ = [
    "MemberNotFoundError",
    "clear_member_avatar",
    "set_member_avatar",
]
