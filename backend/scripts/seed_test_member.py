"""Create an approved, verified SEMO student for local login (skips registration).

Usage (from backend/):
    python -m scripts.seed_test_member
    python -m scripts.seed_test_member --email student@semo.edu --password 'DemoPass123!'

Refuses to run when ENVIRONMENT=production.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.services.organization_context import (
    ensure_default_university_and_org,
    get_default_university_id,
    sync_membership_from_member,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed an approved SEMO test member (local/dev only)"
    )
    parser.add_argument("--email", default="student@semo.edu")
    parser.add_argument("--password", default="DemoPass123!")
    parser.add_argument("--full-name", default="Test Student")
    parser.add_argument("--student-id", default="10000001")
    args = parser.parse_args()

    if settings.ENVIRONMENT == "production":
        raise SystemExit("Refusing to seed a test member in production.")

    email = args.email.lower().strip()
    db = SessionLocal()
    try:
        ensure_default_university_and_org(db)
        existing = db.scalar(select(Member).where(Member.email == email))
        if existing is not None:
            existing.hashed_password = hash_password(args.password)
            existing.status = MemberStatus.APPROVED
            existing.role = MemberRole.GENERAL
            existing.position = MemberPosition.MEMBER
            existing.email_verified_at = existing.email_verified_at or datetime.now(UTC)
            sync_membership_from_member(db, existing)
            db.commit()
            print(f"Updated existing test member {email} (approved, password reset).")
            return

        member = Member(
            full_name=args.full_name,
            email=email,
            student_id=args.student_id,
            major="Computer Science",
            graduation_year=datetime.now().year + 2,
            hashed_password=hash_password(args.password),
            role=MemberRole.GENERAL,
            position=MemberPosition.MEMBER,
            status=MemberStatus.APPROVED,
            talents=[],
            email_verified_at=datetime.now(UTC),
            university_id=get_default_university_id(db),
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        sync_membership_from_member(db, member)
        db.commit()
        print(
            f"Created test member {member.email} id={member.id} "
            f"(password={args.password!r}). Log in without registering."
        )
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        raise
