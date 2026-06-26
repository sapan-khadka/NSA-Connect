from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.volunteer import VolunteerSignupResponse
from app.services.volunteer_service import (
    AlreadySignedUpError,
    VolunteerSlotFullError,
    VolunteerSlotNotFoundError,
    signup_for_volunteer_slot,
)

router = APIRouter(prefix="/slots", tags=["volunteer-slots"])


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

    return VolunteerSignupResponse.from_signup(signup, slot)
