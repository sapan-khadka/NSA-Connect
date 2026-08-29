"""Private notepad entries for board members — each user sees only their own notes."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import member_has_role_at_least
from app.models.event import Event
from app.models.member import Member, MemberRole
from app.models.personal_note import PersonalNote
from app.schemas.personal_note import (
    PersonalNoteListResponse,
    PersonalNoteResponse,
)


class PersonalNoteNotFoundError(Exception):
    pass


class PersonalNotePermissionError(Exception):
    pass


class PersonalNoteEventNotFoundError(Exception):
    pass


def _require_board_access(viewer: Member) -> None:
    if not member_has_role_at_least(viewer, MemberRole.BOARD):
        raise PersonalNotePermissionError


def _resolve_event(db: Session, event_id: int | None) -> Event | None:
    if event_id is None:
        return None
    event = db.get(Event, event_id)
    if event is None:
        raise PersonalNoteEventNotFoundError
    return event


def _to_response(note: PersonalNote) -> PersonalNoteResponse:
    event = note.event
    return PersonalNoteResponse(
        id=note.id,
        title=note.title,
        content=note.content,
        event_id=note.event_id,
        event_name=event.title if event is not None else None,
        event_starts_at=event.starts_at if event is not None else None,
        pinned=bool(note.pinned),
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def list_personal_notes(
    db: Session,
    *,
    owner: Member,
    event_id: int | None = None,
) -> PersonalNoteListResponse:
    _require_board_access(owner)

    query = (
        select(PersonalNote)
        .options(joinedload(PersonalNote.event))
        .where(PersonalNote.owner_id == owner.id)
        .order_by(
            PersonalNote.pinned.desc(),
            PersonalNote.updated_at.desc(),
            PersonalNote.id.desc(),
        )
    )
    if event_id is not None:
        query = query.where(PersonalNote.event_id == event_id)

    rows = db.scalars(query).unique().all()
    notes = [_to_response(row) for row in rows]
    return PersonalNoteListResponse(notes=notes, total=len(notes))


def create_personal_note(
    db: Session,
    *,
    owner: Member,
    content: str,
    title: str | None = None,
    event_id: int | None = None,
    pinned: bool = False,
) -> PersonalNoteResponse:
    _require_board_access(owner)
    event = _resolve_event(db, event_id)

    note = PersonalNote(
        owner_id=owner.id,
        title=title.strip() if title and title.strip() else None,
        content=content.strip(),
        event_id=event.id if event is not None else None,
        pinned=pinned,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    note.event = event
    return _to_response(note)


def update_personal_note(
    db: Session,
    *,
    owner: Member,
    note_id: int,
    content: str | None = None,
    title: str | None = None,
    event_id: int | None = None,
    pinned: bool | None = None,
    clear_event: bool = False,
) -> PersonalNoteResponse:
    _require_board_access(owner)

    note = db.scalar(
        select(PersonalNote)
        .options(joinedload(PersonalNote.event))
        .where(PersonalNote.id == note_id, PersonalNote.owner_id == owner.id),
    )
    if note is None:
        raise PersonalNoteNotFoundError

    if content is not None:
        note.content = content.strip()
    if title is not None:
        note.title = title.strip() if title.strip() else None
    if pinned is not None:
        note.pinned = pinned
    if clear_event:
        note.event_id = None
        note.event = None
    elif event_id is not None:
        event = _resolve_event(db, event_id)
        note.event_id = event.id if event is not None else None
        note.event = event

    note.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(note)
    return _to_response(note)


def delete_personal_note(
    db: Session,
    *,
    owner: Member,
    note_id: int,
) -> None:
    _require_board_access(owner)

    note = db.scalar(
        select(PersonalNote).where(
            PersonalNote.id == note_id,
            PersonalNote.owner_id == owner.id,
        ),
    )
    if note is None:
        raise PersonalNoteNotFoundError

    db.delete(note)
    db.commit()
