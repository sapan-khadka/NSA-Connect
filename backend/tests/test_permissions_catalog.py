"""Permission catalog parity with legacy role/position checks."""

from app.core.permissions import (
    Permission,
    can_manage_meetings,
    can_manage_tasks,
    can_manage_treasury,
    can_view_task_oversight,
    member_has,
    permissions_for_membership,
)
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.organization_membership import OrganizationMembership


def _member(
    *,
    role: MemberRole = MemberRole.GENERAL,
    position: MemberPosition = MemberPosition.MEMBER,
    is_org_owner: bool = False,
) -> Member:
    member = Member(
        full_name="Test",
        email="test@semo.edu",
        student_id=None,
        major="CS",
        graduation_year=2028,
        hashed_password="x",
        role=role,
        position=position,
        status=MemberStatus.APPROVED,
    )
    membership = OrganizationMembership(
        user_id=1,
        organization_id=1,
        role=role,
        position=position,
        status=MemberStatus.APPROVED,
        is_org_owner=is_org_owner,
    )
    member._active_membership = membership
    member._active_organization_id = 1
    return member


def test_board_has_manage_members_not_tasks():
    member = _member(role=MemberRole.BOARD)
    assert member_has(member, Permission.MANAGE_MEMBERS)
    assert not member_has(member, Permission.MANAGE_TASKS)
    assert not can_manage_tasks(member)


def test_president_has_tasks_and_assign_roles():
    member = _member(role=MemberRole.PRESIDENT, position=MemberPosition.PRESIDENT)
    assert can_manage_tasks(member)
    assert can_view_task_oversight(member)
    assert member_has(member, Permission.ASSIGN_ROLES)
    assert can_manage_meetings(member)


def test_owner_alone_cannot_manage_tasks():
    member = _member(role=MemberRole.GENERAL, is_org_owner=True)
    assert member_has(member, Permission.MANAGE_MEMBERS)
    assert member_has(member, Permission.ASSIGN_ROLES)
    assert member_has(member, Permission.TRANSFER_OWNERSHIP)
    assert not can_manage_tasks(member)
    assert not can_view_task_oversight(member)


def test_owner_union_president_keeps_task_permissions():
    member = _member(
        role=MemberRole.PRESIDENT,
        position=MemberPosition.PRESIDENT,
        is_org_owner=True,
    )
    assert can_manage_tasks(member)
    assert member_has(member, Permission.TRANSFER_OWNERSHIP)
    assert member_has(member, Permission.MANAGE_ORG_SETTINGS)


def test_vice_president_treasury_and_tasks():
    member = _member(role=MemberRole.BOARD, position=MemberPosition.VICE_PRESIDENT)
    assert can_manage_treasury(member)
    assert can_manage_tasks(member)
    assert can_manage_meetings(member)


def test_secretary_meetings_only_extra():
    member = _member(role=MemberRole.BOARD, position=MemberPosition.SECRETARY)
    assert can_manage_meetings(member)
    assert not can_manage_tasks(member)


def test_permissions_for_membership_union_is_idempotent():
    base = permissions_for_membership(
        role=MemberRole.PRESIDENT,
        position=MemberPosition.PRESIDENT,
        is_org_owner=True,
    )
    again = permissions_for_membership(
        role=MemberRole.PRESIDENT,
        position=MemberPosition.PRESIDENT,
        is_org_owner=True,
    )
    assert base == again
    assert Permission.MANAGE_TASKS in base
    assert Permission.TRANSFER_OWNERSHIP in base
