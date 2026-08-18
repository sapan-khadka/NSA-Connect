"""Platform permission catalog (code-only; not org-editable yet).

Maps today's MemberRole + MemberPosition + is_org_owner onto a fixed set of
permissions so services can become permission-aware without changing who can
do what in the SEMO/NSA single-tenant runtime.

Owner permissions are unioned with chapter-role permissions when the same
membership is both org owner and president/board/etc.
"""

from __future__ import annotations

from collections.abc import Iterable
from enum import StrEnum

from app.models.member import Member, MemberPosition, MemberRole
from app.models.organization_membership import OrganizationMembership


class Permission(StrEnum):
    MANAGE_MEMBERS = "manage_members"
    INVITE_MEMBERS = "invite_members"
    ASSIGN_ROLES = "assign_roles"
    MANAGE_EVENTS = "manage_events"
    MANAGE_FINANCE = "manage_finance"
    MANAGE_FINANCE_WRITE = "manage_finance_write"
    MANAGE_TASKS = "manage_tasks"
    VIEW_TASK_OVERSIGHT = "view_task_oversight"
    MANAGE_MEETINGS = "manage_meetings"
    MANAGE_DISCUSSIONS = "manage_discussions"
    MANAGE_ANNOUNCEMENTS = "manage_announcements"
    MANAGE_DOCUMENTS = "manage_documents"
    MANAGE_GALLERY = "manage_gallery"
    MANAGE_AI = "manage_ai"
    MANAGE_REPORTS = "manage_reports"
    MANAGE_ORG_SETTINGS = "manage_org_settings"
    TRANSFER_OWNERSHIP = "transfer_ownership"


# Board+ chapter capabilities (matches require_board and related surfaces).
_BOARD_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.MANAGE_MEMBERS,
        Permission.INVITE_MEMBERS,
        Permission.MANAGE_EVENTS,
        Permission.MANAGE_FINANCE,
        Permission.MANAGE_DISCUSSIONS,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.MANAGE_DOCUMENTS,
        Permission.MANAGE_GALLERY,
        Permission.MANAGE_AI,
        Permission.MANAGE_REPORTS,
    }
)

_TREASURER_EXTRA: frozenset[Permission] = frozenset(
    {
        Permission.MANAGE_FINANCE_WRITE,
    }
)

_PRESIDENT_EXTRA: frozenset[Permission] = frozenset(
    {
        Permission.ASSIGN_ROLES,
        Permission.MANAGE_TASKS,
        Permission.VIEW_TASK_OVERSIGHT,
        Permission.MANAGE_MEETINGS,
        Permission.MANAGE_ORG_SETTINGS,
    }
)

# Org owner: bootstrap / monitor — approvals & settings, not task ops.
_OWNER_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.MANAGE_MEMBERS,
        Permission.INVITE_MEMBERS,
        Permission.ASSIGN_ROLES,
        Permission.MANAGE_ORG_SETTINGS,
        Permission.TRANSFER_OWNERSHIP,
        Permission.MANAGE_EVENTS,
        Permission.MANAGE_FINANCE,
        Permission.MANAGE_DISCUSSIONS,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.MANAGE_DOCUMENTS,
        Permission.MANAGE_GALLERY,
        Permission.MANAGE_AI,
        Permission.MANAGE_REPORTS,
        # Explicitly NOT: MANAGE_TASKS, VIEW_TASK_OVERSIGHT (unless also officer)
    }
)


def _permissions_for_role(role: MemberRole) -> set[Permission]:
    perms: set[Permission] = set()
    if role.is_at_least(MemberRole.BOARD):
        perms |= _BOARD_PERMISSIONS
    if role.is_at_least(MemberRole.TREASURER):
        perms |= _TREASURER_EXTRA
    if role == MemberRole.PRESIDENT:
        perms |= _PRESIDENT_EXTRA
    return perms


def _permissions_for_position(position: MemberPosition) -> set[Permission]:
    perms: set[Permission] = set()
    if position == MemberPosition.VICE_PRESIDENT:
        perms |= {
            Permission.MANAGE_FINANCE_WRITE,
            Permission.MANAGE_TASKS,
            Permission.VIEW_TASK_OVERSIGHT,
            Permission.MANAGE_MEETINGS,
        }
    if position == MemberPosition.EVENT_MANAGER:
        perms |= {Permission.MANAGE_TASKS}
    if position == MemberPosition.SECRETARY:
        perms |= {Permission.MANAGE_MEETINGS}
    if position == MemberPosition.PRESIDENT:
        perms |= _PRESIDENT_EXTRA | _BOARD_PERMISSIONS | _TREASURER_EXTRA
    if position == MemberPosition.TREASURER:
        perms |= _BOARD_PERMISSIONS | _TREASURER_EXTRA
    return perms


def permissions_for_membership(
    *,
    role: MemberRole,
    position: MemberPosition,
    is_org_owner: bool = False,
) -> frozenset[Permission]:
    """Union of chapter role/position permissions and org-owner permissions."""
    perms = _permissions_for_role(role) | _permissions_for_position(position)
    if is_org_owner:
        perms |= _OWNER_PERMISSIONS
    return frozenset(perms)


def active_membership(member: Member) -> OrganizationMembership | None:
    return getattr(member, "_active_membership", None)


def effective_role(member: Member) -> MemberRole:
    membership = active_membership(member)
    if membership is not None:
        return membership.role
    return member.role


def effective_position(member: Member) -> MemberPosition:
    membership = active_membership(member)
    if membership is not None:
        return membership.position
    return member.position


def effective_is_org_owner(member: Member) -> bool:
    membership = active_membership(member)
    if membership is not None:
        return bool(membership.is_org_owner)
    return False


def member_permissions(member: Member) -> frozenset[Permission]:
    return permissions_for_membership(
        role=effective_role(member),
        position=effective_position(member),
        is_org_owner=effective_is_org_owner(member),
    )


def member_has(member: Member, permission: Permission) -> bool:
    return permission in member_permissions(member)


def member_has_any(member: Member, permissions: Iterable[Permission]) -> bool:
    owned = member_permissions(member)
    return any(permission in owned for permission in permissions)


def member_has_role_at_least(member: Member, minimum: MemberRole) -> bool:
    """Membership-aware replacement for Member.has_role_at_least.

    Org owners satisfy general/board/president admin gates so they can approve
    members and appoint a chapter president without holding the president seat.
    They do not automatically satisfy treasurer write gates.
    """
    if effective_role(member).is_at_least(minimum):
        return True
    if not effective_is_org_owner(member):
        return False
    return minimum in {
        MemberRole.GENERAL,
        MemberRole.BOARD,
        MemberRole.PRESIDENT,
    }


def can_manage_treasury(member: Member) -> bool:
    return member_has(member, Permission.MANAGE_FINANCE_WRITE)


def can_manage_tasks(member: Member) -> bool:
    return member_has(member, Permission.MANAGE_TASKS)


def can_view_task_oversight(member: Member) -> bool:
    return member_has(member, Permission.VIEW_TASK_OVERSIGHT)


def can_manage_meetings(member: Member) -> bool:
    return member_has(member, Permission.MANAGE_MEETINGS)
