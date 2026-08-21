from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import (
    Permission,
    can_manage_meetings,
    can_manage_tasks,
    can_manage_treasury,
    can_view_task_oversight,
    member_has,
    member_has_role_at_least,
)
from app.core.security import InvalidTokenError, decode_access_token
from app.models.member import Member, MemberRole
from app.models.organization import Organization
from app.services.auth_service import (
    AuthTokenKind,
    InvalidTokenPayloadError,
    MemberNotApprovedError,
    MemberNotFoundForTokenError,
    TokenRevokedError,
    invalid_payload_detail,
    load_authenticated_member,
    revoked_detail,
)

security = HTTPBearer()


def get_current_member(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Member:
    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        return load_authenticated_member(db, payload)
    except InvalidTokenPayloadError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=invalid_payload_detail(AuthTokenKind.ACCESS),
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
            detail=revoked_detail(AuthTokenKind.ACCESS),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except MemberNotApprovedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        ) from exc


def get_current_organization(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
) -> Organization:
    organization_id = getattr(current_member, "_active_organization_id", None)
    if organization_id is None:
        from app.services.organization_context import get_default_organization_id

        organization_id = get_default_organization_id(db)

    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return organization


def require_permission(permission: Permission):
    """FastAPI dependency: require a platform permission on the active membership.

    Routes today use role/position guards (``require_board``, etc.) instead.
    Keep this for future permission-matrix endpoints.
    """

    def guard(current_member: Member = Depends(get_current_member)) -> Member:
        if not member_has(current_member, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires permission: {permission.value}",
            )
        return current_member

    return guard


def _require_role(minimum_role: MemberRole):
    def guard(current_member: Member = Depends(get_current_member)) -> Member:
        if not member_has_role_at_least(current_member, minimum_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum_role.value} role or higher",
            )
        return current_member

    return guard


require_board = _require_role(MemberRole.BOARD)
require_treasurer = _require_role(MemberRole.TREASURER)
require_president = _require_role(MemberRole.PRESIDENT)


def require_treasury_writer(
    current_member: Member = Depends(get_current_member),
) -> Member:
    """Allow treasurer+, or vice president by position (board role)."""
    if can_manage_treasury(current_member):
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires treasurer, president, or vice president",
    )


def require_task_manager(
    current_member: Member = Depends(get_current_member),
) -> Member:
    """Allow President (by role) or Vice President / Event Manager (by position)."""
    if can_manage_tasks(current_member):
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires president, vice president, or event manager",
    )


def require_task_oversight(
    current_member: Member = Depends(get_current_member),
) -> Member:
    """Allow President (by role) or Vice President (by position)."""
    if can_view_task_oversight(current_member):
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires president or vice president",
    )


def require_meeting_manager(
    current_member: Member = Depends(get_current_member),
) -> Member:
    if can_manage_meetings(current_member):
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires secretary, vice president, or president",
    )
