from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.volunteer import MemberVolunteerSignupListResponse
from app.services.volunteer_service import list_volunteer_signups_for_member

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/volunteer-signups", response_model=MemberVolunteerSignupListResponse)
def list_my_volunteer_signups_endpoint(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    signups = list_volunteer_signups_for_member(db, current_member.id)
    return MemberVolunteerSignupListResponse(signups=signups, total=len(signups))
