"""
Private officer notes about a member.

Access is board+ only (same tier as canViewMemberDirectory). The subject member
never has access — including when viewing their own workspace.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.member import Member, MemberRole, MemberStatus
from app.models.member_note import MemberNote
from app.schemas.member_note import (
    MemberNoteListResponse,
    MemberNoteResponse,
)
from app.services.member_service import MemberNotFoundError, get_member_by_id


class MemberNoteNotFoundError(Exception):
    pass


class MemberNotePermissionError(Exception):
    pass


def _require_board_notes_access(viewer: Member) -> None:
    if not viewer.has_role_at_least(MemberRole.BOARD):
        raise MemberNotePermissionError


def _display_name(member: Member | None) -> str:
    if member is None:
        return "Unknown"
    return member.full_name or member.email


def _to_response(note: MemberNote) -> MemberNoteResponse:
    return MemberNoteResponse(
        id=note.id,
        member_id=note.member_id,
        author_id=note.author_id,
        author_name=_display_name(note.author),
        content=note.content,
        pinned=bool(note.pinned),
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def ensure_member_accessible(db: Session, member_id: int, viewer: Member) -> Member:
    try:
        subject = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise

    if subject.status != MemberStatus.APPROVED and not viewer.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise MemberNotFoundError

    return subject


def list_member_notes(
    db: Session,
    *,
    member_id: int,
    viewer: Member,
) -> MemberNoteListResponse:
    _require_board_notes_access(viewer)
    ensure_member_accessible(db, member_id, viewer)

    rows = (
        db.scalars(
            select(MemberNote)
            .options(joinedload(MemberNote.author))
            .where(MemberNote.member_id == member_id)
            .order_by(
                MemberNote.pinned.desc(),
                MemberNote.updated_at.desc(),
                MemberNote.id.desc(),
            ),
        )
        .unique()
        .all()
    )
    notes = [_to_response(row) for row in rows]
    return MemberNoteListResponse(
        member_id=member_id,
        notes=notes,
        total=len(notes),
    )


def create_member_note(
    db: Session,
    *,
    member_id: int,
    author: Member,
    content: str,
    pinned: bool = False,
) -> MemberNoteResponse:
    _require_board_notes_access(author)
    ensure_member_accessible(db, member_id, author)

    note = MemberNote(
        member_id=member_id,
        author_id=author.id,
        content=content.strip(),
        pinned=pinned,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    note.author = author
    return _to_response(note)


def update_member_note(
    db: Session,
    *,
    member_id: int,
    note_id: int,
    viewer: Member,
    content: str | None = None,
    pinned: bool | None = None,
) -> MemberNoteResponse:
    _require_board_notes_access(viewer)
    ensure_member_accessible(db, member_id, viewer)

    note = db.scalar(
        select(MemberNote)
        .options(joinedload(MemberNote.author))
        .where(MemberNote.id == note_id, MemberNote.member_id == member_id),
    )
    if note is None:
        raise MemberNoteNotFoundError

    if content is not None:
        note.content = content.strip()
    if pinned is not None:
        note.pinned = pinned
    note.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(note)
    return _to_response(note)


def delete_member_note(
    db: Session,
    *,
    member_id: int,
    note_id: int,
    viewer: Member,
) -> None:
    _require_board_notes_access(viewer)
    ensure_member_accessible(db, member_id, viewer)

    note = db.scalar(
        select(MemberNote).where(
            MemberNote.id == note_id,
            MemberNote.member_id == member_id,
        ),
    )
    if note is None:
        raise MemberNoteNotFoundError

    db.delete(note)
    db.commit()
