from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.core.security import InvalidTokenError, create_token_pair, decode_refresh_token
from app.models.member import Member
from app.schemas.auth import RefreshTokenRequest, TokenResponse
from app.schemas.member import MemberCreateRequest, MemberLoginRequest, MemberResponse
from app.core.password_validation import WeakPasswordError
from app.services.member_service import (
    InvalidCredentialsError,
    MemberAlreadyExistsError,
    MemberNotApprovedError,
    StudentIdAlreadyExistsError,
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
    except StudentIdAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student ID already registered",
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=member)


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

    (
        access_token,
        expires_at,
        refresh_token,
        refresh_expires_at,
    ) = create_token_pair(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        refresh_expires_at=refresh_expires_at,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_refresh_token(data.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    member_id = payload.get("member_id")
    if member_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Member not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("email") != member.email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("tv") != member.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not member.can_authenticate():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        )

    (
        access_token,
        expires_at,
        refresh_token,
        refresh_expires_at,
    ) = create_token_pair(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        refresh_expires_at=refresh_expires_at,
    )


@router.get("/me", response_model=MemberResponse)
def me(current_member: Member = Depends(get_current_member)):
    return MemberResponse.from_member(current_member, viewer=current_member)
