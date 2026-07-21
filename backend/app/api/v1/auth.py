from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_member, get_current_organization
from app.core.password_validation import WeakPasswordError
from app.core.rate_limit import (
    AppRateLimitExceeded,
    check_login_account_failures,
    check_password_reset_email_limit,
    clear_login_failures,
    limit,
    record_login_failure,
)
from app.core.security import (
    InvalidTokenError,
    create_token_pair,
    decode_refresh_token,
    resolve_user_id,
)
from app.models.member import Member
from app.models.organization import Organization
from app.schemas.auth import (
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.member import MemberCreateRequest, MemberLoginRequest, MemberResponse
from app.services.member_service import (
    InvalidCredentialsError,
    MemberAlreadyExistsError,
    MemberNotApprovedError,
    StudentIdAlreadyExistsError,
    authenticate_member,
    create_member,
)
from app.services.organization_context import get_default_organization
from app.services.password_reset_service import (
    PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
    PASSWORD_RESET_REQUEST_MESSAGE,
    InvalidPasswordResetTokenError,
    request_password_reset,
    reset_password_with_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
@limit(f"{settings.RATE_LIMIT_REGISTER_IP_MAX}/hour")
def register(
    request: Request,
    data: MemberCreateRequest,
    db: Session = Depends(get_db),
):
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

    organization = get_default_organization(db)
    return MemberResponse.from_member(member, viewer=member, organization=organization)


@router.post("/login", response_model=TokenResponse)
@limit(f"{settings.RATE_LIMIT_LOGIN_IP_MAX}/minute")
def login(
    request: Request,
    data: MemberLoginRequest,
    db: Session = Depends(get_db),
):
    try:
        check_login_account_failures(data.email)
    except AppRateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.detail,
        ) from None

    try:
        member = authenticate_member(db, data.email, data.password)
    except InvalidCredentialsError:
        record_login_failure(data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from None
    except MemberNotApprovedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        ) from None

    clear_login_failures(data.email)

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

    user_id = resolve_user_id(payload)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    member = db.get(Member, user_id)
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
def me(
    current_member: Member = Depends(get_current_member),
    current_organization: Organization = Depends(get_current_organization),
):
    return MemberResponse.from_member(
        current_member,
        viewer=current_member,
        organization=current_organization,
    )


@router.post("/password-reset/request", response_model=PasswordResetRequestResponse)
@limit(f"{settings.RATE_LIMIT_PASSWORD_RESET_IP_MAX}/hour")
def password_reset_request(
    request: Request,
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    try:
        check_password_reset_email_limit(data.email)
    except AppRateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.detail,
        ) from None

    request_password_reset(db, data.email)
    return PasswordResetRequestResponse(message=PASSWORD_RESET_REQUEST_MESSAGE)


@router.post("/password-reset/confirm")
def password_reset_confirm(
    data: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    try:
        reset_password_with_token(
            db,
            raw_token=data.token,
            new_password=data.new_password,
        )
    except InvalidPasswordResetTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return {
        "message": "Password updated. You can sign in with your new password.",
    }
