from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.member import MemberCreateRequest, MemberResponse
from app.services.member_service import MemberAlreadyExistsError, create_member

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(data: MemberCreateRequest, db: Session = Depends(get_db)):
    try:
        member = create_member(db, data)
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return member

# TODO: POST /login — authenticate and return JWT access token
# TODO: POST /logout — invalidate session / token
# TODO: GET /me — return current authenticated member
