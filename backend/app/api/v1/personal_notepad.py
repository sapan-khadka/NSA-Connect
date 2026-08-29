from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.personal_note import (
    PersonalNoteCreateRequest,
    PersonalNoteListResponse,
    PersonalNoteResponse,
    PersonalNoteUpdateRequest,
)
from app.services.personal_note_service import (
    PersonalNoteEventNotFoundError,
    PersonalNoteNotFoundError,
    PersonalNotePermissionError,
    create_personal_note,
    delete_personal_note,
    list_personal_notes,
    update_personal_note,
)

router = APIRouter(prefix="/me/notepad", tags=["personal-notepad"])


@router.get("", response_model=PersonalNoteListResponse)
def list_my_notepad_notes(
    event_id: int | None = Query(default=None),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return list_personal_notes(db, owner=current_member, event_id=event_id)
    except PersonalNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board access required",
        ) from None


@router.post("", response_model=PersonalNoteResponse, status_code=status.HTTP_201_CREATED)
def create_my_notepad_note(
    body: PersonalNoteCreateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return create_personal_note(
            db,
            owner=current_member,
            title=body.title,
            content=body.content,
            event_id=body.event_id,
            pinned=body.pinned,
        )
    except PersonalNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board access required",
        ) from None
    except PersonalNoteEventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None


@router.patch("/{note_id}", response_model=PersonalNoteResponse)
def update_my_notepad_note(
    note_id: int,
    body: PersonalNoteUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return update_personal_note(
            db,
            owner=current_member,
            note_id=note_id,
            title=body.title,
            content=body.content,
            event_id=body.event_id,
            pinned=body.pinned,
            clear_event=body.clear_event,
        )
    except PersonalNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board access required",
        ) from None
    except PersonalNoteEventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except PersonalNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        ) from None


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_notepad_note(
    note_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        delete_personal_note(db, owner=current_member, note_id=note_id)
    except PersonalNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Board access required",
        ) from None
    except PersonalNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        ) from None
