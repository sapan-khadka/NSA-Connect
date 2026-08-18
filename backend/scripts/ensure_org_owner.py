"""Ensure NSA has an org owner (wipe-recovery / bootstrap helper).

Does NOT delete members or org data. Safe to run on a live database.

Usage (from backend/):
    python -m scripts.ensure_org_owner
    python -m scripts.ensure_org_owner --email owner@example.com

Without --email: promotes an existing approved president/board+ membership
to is_org_owner when none exists.

With --email: finds that user, ensures they are approved + org owner
(without claiming the president seat). Use --force to transfer ownership.
"""

from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.member import Member, MemberStatus
from app.models.organization_membership import OrganizationMembership
from app.services.organization_context import (
    ensure_default_university_and_org,
    ensure_membership_for_member,
    ensure_nsa_org_owner,
    get_default_organization_id,
    get_membership_for_user,
    sync_membership_from_member,
)


def _promote_email(db, email: str, *, force: bool) -> None:
    member = db.scalar(select(Member).where(Member.email == email.lower().strip()))
    if member is None:
        print(f"No user with email {email!r}")
        return

    org_id = get_default_organization_id(db)
    membership = get_membership_for_user(db, member.id, org_id)
    if membership is None:
        membership = ensure_membership_for_member(db, member)

    existing_owner = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.is_org_owner.is_(True),
        ),
    )
    if existing_owner is not None and existing_owner.user_id != member.id and not force:
        print(
            f"Org already has owner user_id={existing_owner.user_id}. "
            "Pass --force to transfer ownership to this email.",
        )
        return

    if existing_owner is not None and existing_owner.user_id != member.id and force:
        existing_owner.is_org_owner = False

    member.status = MemberStatus.APPROVED
    # Do not claim the exclusive president seat — owner appoints a president.
    sync_membership_from_member(db, member, organization_id=org_id)
    membership = get_membership_for_user(db, member.id, org_id)
    assert membership is not None
    membership.status = MemberStatus.APPROVED
    membership.is_org_owner = True
    db.commit()
    print(
        f"Promoted {member.email} → approved org owner "
        f"(role={member.role.value}, position={member.position.value}, "
        f"membership id={membership.id})",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ensure NSA org owner membership")
    parser.add_argument(
        "--email",
        help="Promote this existing user to approved org owner (not president)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow transferring is_org_owner when another owner already exists",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        ensure_default_university_and_org(db)
        if args.email:
            _promote_email(db, args.email, force=args.force)
            return

        owner = ensure_nsa_org_owner(db)
        if owner is None:
            print(
                "No approved board+ membership to promote.\n"
                "Either register the allowlisted owner email, or:\n"
                "  python -m scripts.ensure_org_owner --email you@example.com",
            )
            return
        print(
            f"NSA org owner membership id={owner.id} user_id={owner.user_id} "
            f"role={owner.role.value}",
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
