from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import InvalidTokenError, decode_access_token
from app.models.member import Member, MemberPosition, MemberRole

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

    member_id = payload.get("member_id")
    if member_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Member not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_email = payload.get("email")
    if token_email != member.email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_version = payload.get("tv")
    if token_version != member.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not member.can_authenticate():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Member account is not approved",
        )

    return member


def _require_role(minimum_role: MemberRole):
    def guard(current_member: Member = Depends(get_current_member)) -> Member:
        if not current_member.has_role_at_least(minimum_role):
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
    if current_member.has_role_at_least(MemberRole.TREASURER):
        return current_member
    if current_member.position == MemberPosition.VICE_PRESIDENT:
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires treasurer, president, or vice president",
    )


def require_task_manager(
    current_member: Member = Depends(get_current_member),
) -> Member:
    """Allow President (by role) or Vice President / Event Manager (by position)."""
    if current_member.role == MemberRole.PRESIDENT or current_member.position in {
        MemberPosition.VICE_PRESIDENT,
        MemberPosition.EVENT_MANAGER,
    }:
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires president, vice president, or event manager",
    )


def require_task_oversight(
    current_member: Member = Depends(get_current_member),
) -> Member:
    """Allow President (by role) or Vice President (by position)."""
    if (
        current_member.role == MemberRole.PRESIDENT
        or current_member.position == MemberPosition.VICE_PRESIDENT
    ):
        return current_member
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires president or vice president",
    )
