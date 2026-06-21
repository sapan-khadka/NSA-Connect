from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.schemas.auth import TokenResponse
from app.schemas.member import MemberCreateRequest, MemberLoginRequest, MemberResponse
from app.services.member_service import (
    InvalidCredentialsError,
    MemberAlreadyExistsError,
    MemberNotApprovedError,
    authenticate_member,
    create_member,
)

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


@router.post("/login", response_model=TokenResponse)
def login(data: MemberLoginRequest, db: Session = Depends(get_db)):
    try:
        member = authenticate_member(db, data.email, data.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from None
    except MemberNotApprovedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        ) from None

    access_token, expires_at = create_access_token(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
    )

    return TokenResponse(access_token=access_token, expires_at=expires_at)

# TODO: POST /logout — invalidate session / token
# TODO: GET /me — return current authenticated member
