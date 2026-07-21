from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.volunteer import (
    VolunteerSignupResponse,
    VolunteerSlotPatchRequest,
    VolunteerSlotResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.volunteer_service import (
    AlreadySignedUpError,
    NotSignedUpError,
    VolunteerSlotCapacityTooLowError,
    VolunteerSlotFullError,
    VolunteerSlotNotFoundError,
    delete_volunteer_slot,
    signup_for_volunteer_slot,
    update_volunteer_slot,
    withdraw_from_volunteer_slot,
)
from app.tasks.email_tasks import send_volunteer_task_assigned_email_task

router = APIRouter(prefix="/slots", tags=["volunteer-slots"])


@router.patch("/{slot_id}", response_model=VolunteerSlotResponse)
def patch_volunteer_slot_endpoint(
    slot_id: int,
    data: VolunteerSlotPatchRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    if not data.has_updates():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates provided",
        )
    try:
        slot = update_volunteer_slot(db, slot_id, data)
    except VolunteerSlotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer slot not found",
        ) from None
    except VolunteerSlotCapacityTooLowError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Capacity cannot be below current signup count",
        ) from None

    return VolunteerSlotResponse.from_slot(
        slot,
        member_id=current_member.id,
        include_roster=True,
    )


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_volunteer_slot_endpoint(
    slot_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        delete_volunteer_slot(db, slot_id)
    except VolunteerSlotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer slot not found",
        ) from None
    return None


@router.post(
    "/{slot_id}/signup",
    response_model=VolunteerSignupResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup_for_volunteer_slot_endpoint(
    slot_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        signup, slot = signup_for_volunteer_slot(db, slot_id, current_member.id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer slot not found",
        ) from None
    except VolunteerSlotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer slot not found",
        ) from None
    except VolunteerSlotFullError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Volunteer slot is full",
        ) from None
    except AlreadySignedUpError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already signed up for this volunteer slot",
        ) from None

    send_volunteer_task_assigned_email_task.delay(
        email=current_member.email,
        full_name=current_member.full_name,
        task_name=slot.title,
        event_title=slot.event.title,
        event_starts_at_iso=slot.event.starts_at.isoformat(),
    )

    return VolunteerSignupResponse.from_signup(signup, slot)


@router.delete(
    "/{slot_id}/signup",
    response_model=VolunteerSlotResponse,
)
def withdraw_from_volunteer_slot_endpoint(
    slot_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        slot = withdraw_from_volunteer_slot(db, slot_id, current_member.id)
    except VolunteerSlotNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer slot not found",
        ) from None
    except NotSignedUpError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not signed up for this volunteer slot",
        ) from None

    return VolunteerSlotResponse.from_slot(
        slot,
        member_id=current_member.id,
        include_roster=False,
    )
