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
)
from app.core.security_events import log_security_event
from app.models.member import Member
from app.models.organization import Organization
from app.schemas.auth import (
    EmailVerificationConfirmRequest,
    EmailVerificationRequest,
    EmailVerificationResponse,
    LogoutResponse,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.member import MemberCreateRequest, MemberLoginRequest, MemberResponse
from app.services.auth_service import (
    AuthTokenKind,
    InvalidTokenPayloadError,
    MemberNotFoundForTokenError,
    TokenRevokedError,
    invalid_payload_detail,
    load_authenticated_member,
    revoked_detail,
)
from app.services.auth_service import (
    MemberNotApprovedError as TokenMemberNotApprovedError,
)
from app.services.email_verification_service import (
    EMAIL_VERIFICATION_INVALID_TOKEN_MESSAGE,
    EMAIL_VERIFICATION_REQUEST_MESSAGE,
    EMAIL_VERIFICATION_SUCCESS_MESSAGE,
    InvalidEmailVerificationTokenError,
    request_email_verification,
    verify_email_with_token,
)
from app.services.member_service import (
    InvalidCredentialsError,
    InvalidRegistrationEmailError,
    MemberAlreadyExistsError,
    MemberEmailNotVerifiedError,
    MemberNotApprovedError,
    StudentIdAlreadyExistsError,
    StudentIdRequiredError,
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

# Avoid confirming whether an email/student ID is already registered.
REGISTER_CONFLICT_MESSAGE = (
    "Unable to complete registration. If you already have an account, sign in "
    "or reset your password."
)


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
    except (MemberAlreadyExistsError, StudentIdAlreadyExistsError):
        log_security_event(
            "register_conflict",
            request=request,
            email=data.email.lower().strip(),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=REGISTER_CONFLICT_MESSAGE,
        ) from None
    except StudentIdRequiredError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Student ID is required",
        ) from None
    except InvalidRegistrationEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    log_security_event(
        "register_success",
        request=request,
        member_id=member.id,
        email=member.email,
    )
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
        log_security_event(
            "login_locked",
            request=request,
            email=data.email.lower().strip(),
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.detail,
        ) from None

    try:
        member = authenticate_member(db, data.email, data.password)
    except InvalidCredentialsError:
        record_login_failure(data.email)
        log_security_event(
            "login_failure",
            request=request,
            email=data.email.lower().strip(),
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from None
    except MemberEmailNotVerifiedError:
        log_security_event(
            "login_failure",
            request=request,
            email=data.email.lower().strip(),
            reason="email_unverified",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before signing in",
        ) from None
    except MemberNotApprovedError:
        log_security_event(
            "login_failure",
            request=request,
            email=data.email.lower().strip(),
            reason="not_approved",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        ) from None

    clear_login_failures(data.email)
    log_security_event(
        "login_success",
        request=request,
        member_id=member.id,
        email=member.email,
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

    try:
        member = load_authenticated_member(db, payload, attach_membership=False)
    except InvalidTokenPayloadError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=invalid_payload_detail(AuthTokenKind.REFRESH),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except MemberNotFoundForTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Member not found",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except TokenRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=revoked_detail(AuthTokenKind.REFRESH),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except TokenMemberNotApprovedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        ) from exc

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


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    current_member.token_version += 1
    db.commit()
    log_security_event(
        "logout",
        request=request,
        member_id=current_member.id,
        email=current_member.email,
    )
    return LogoutResponse(message="Logged out")


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


@router.post("/verify-email", response_model=EmailVerificationResponse)
def verify_email(
    data: EmailVerificationConfirmRequest,
    db: Session = Depends(get_db),
):
    try:
        verify_email_with_token(db, data.token)
    except InvalidEmailVerificationTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=EMAIL_VERIFICATION_INVALID_TOKEN_MESSAGE,
        ) from None
    return EmailVerificationResponse(message=EMAIL_VERIFICATION_SUCCESS_MESSAGE)


@router.post(
    "/verify-email/resend",
    response_model=EmailVerificationResponse,
)
@limit(f"{settings.RATE_LIMIT_PASSWORD_RESET_IP_MAX}/hour")
def resend_verification_email(
    request: Request,
    data: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    try:
        check_password_reset_email_limit(data.email)
    except AppRateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.detail,
        ) from None

    request_email_verification(db, data.email)
    return EmailVerificationResponse(message=EMAIL_VERIFICATION_REQUEST_MESSAGE)


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
    log_security_event(
        "password_reset_request",
        request=request,
        email=data.email.lower().strip(),
    )
    return PasswordResetRequestResponse(message=PASSWORD_RESET_REQUEST_MESSAGE)


@router.post("/password-reset/confirm", response_model=PasswordResetConfirmResponse)
def password_reset_confirm(
    request: Request,
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
        log_security_event(
            "password_reset_confirm_failure",
            request=request,
            reason="invalid_token",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    log_security_event("password_reset_confirm_success", request=request)
    return PasswordResetConfirmResponse(
        message="Password updated. You can sign in with your new password.",
    )
