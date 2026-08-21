"""Create the allowlisted chapter org-owner account (pilot bootstrap).

Reads ORG_OWNER_EMAIL / ORG_OWNER_PASSWORD from the environment (falls back to
the first address in settings.ORG_OWNER_EMAILS). Safe to re-run: existing email
is left alone unless --force-password is passed.

Usage (from backend/):
    export ORG_OWNER_EMAILS=nsa.connect@gmail.com
    export ORG_OWNER_EMAIL=nsa.connect@gmail.com
    export ORG_OWNER_PASSWORD='…strong password…'
    python -m scripts.seed_chapter_owner
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.core.validators import is_org_owner_email
from app.models.member import Member, MemberStatus
from app.schemas.member import MemberCreateRequest
from app.services.member_service import MemberAlreadyExistsError, create_member
from app.services.organization_context import (
    ensure_default_university_and_org,
    ensure_membership_for_member,
    get_default_organization_id,
    get_membership_for_user,
    sync_membership_from_member,
)


def _resolve_email() -> str:
    explicit = os.environ.get("ORG_OWNER_EMAIL", "").strip().lower()
    if explicit:
        return explicit
    owners = sorted(settings.org_owner_email_set)
    if not owners:
        raise SystemExit(
            "Set ORG_OWNER_EMAILS (and optionally ORG_OWNER_EMAIL) before seeding."
        )
    return owners[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed chapter org-owner account")
    parser.add_argument(
        "--force-password",
        action="store_true",
        help="Reset password if the owner account already exists",
    )
    parser.add_argument(
        "--full-name",
        default="Chapter Owner",
        help="Display name for a newly created owner",
    )
    args = parser.parse_args()

    email = _resolve_email()
    if not is_org_owner_email(email):
        raise SystemExit(
            f"{email!r} is not in ORG_OWNER_EMAILS — refuse to seed non-allowlisted owner."
        )

    password = os.environ.get("ORG_OWNER_PASSWORD", "").strip()
    if not password:
        raise SystemExit("Set ORG_OWNER_PASSWORD in the environment.")

    db = SessionLocal()
    try:
        ensure_default_university_and_org(db)
        existing = db.scalar(select(Member).where(Member.email == email))
        if existing is not None:
            if args.force_password:
                existing.hashed_password = hash_password(password)
                existing.status = MemberStatus.APPROVED
                if existing.email_verified_at is None:
                    existing.email_verified_at = datetime.now(UTC)
                # Keep chapter role/position; ownership is is_org_owner only.
                sync_membership_from_member(db, existing)
                membership = get_membership_for_user(
                    db, existing.id, get_default_organization_id(db)
                )
                if membership is None:
                    membership = ensure_membership_for_member(db, existing)
                membership.status = MemberStatus.APPROVED
                membership.is_org_owner = True
                db.commit()
                print(f"Updated existing owner {email} (password reset).")
                return
            if existing.email_verified_at is None:
                existing.email_verified_at = datetime.now(UTC)
                db.commit()
                print(f"Owner {email} already exists — marked email verified.")
                return
            print(f"Owner {email} already exists (id={existing.id}). No changes.")
            return

        try:
            member = create_member(
                db,
                MemberCreateRequest(
                    full_name=args.full_name,
                    email=email,
                    student_id=None,
                    major="Chapter operations",
                    graduation_year=datetime.now().year + 1,
                    password=password,
                ),
            )
        except MemberAlreadyExistsError:
            print(f"Owner {email} already exists. No changes.")
            return

        # Seeded owners are trusted — skip inbox click for bootstrap.
        member.email_verified_at = datetime.now(UTC)
        db.commit()

        membership = get_membership_for_user(
            db, member.id, get_default_organization_id(db)
        )
        print(
            f"Created owner {member.email} id={member.id} "
            f"status={member.status.value} role={member.role.value} "
            f"is_org_owner={bool(membership and membership.is_org_owner)}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        raise
