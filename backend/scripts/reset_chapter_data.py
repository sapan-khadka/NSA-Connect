"""Wipe chapter data for a fresh real-org start (local/staging only).

Deletes members, events, finance, discussions, tasks, etc. Keeps the SEMO
university + NSA organization rows and Alembic migration history.

Usage (from backend/):
    python -m scripts.reset_chapter_data --yes
    # then re-seed the allowlisted owner:
    export ORG_OWNER_EMAILS=nsa.southeast.mo@gmail.com
    export ORG_OWNER_PASSWORD='…'
    python -m scripts.seed_chapter_owner
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.services.organization_context import ensure_default_university_and_org

# Import models so metadata is complete.
import app.models  # noqa: F401


def _table_names() -> list[str]:
    names = [table.name for table in Base.metadata.sorted_tables]
    # Keep migration bookkeeping.
    return [name for name in names if name != "alembic_version"]


def reset_chapter_data(*, yes: bool) -> None:
    if settings.ENVIRONMENT == "production" and not yes:
        raise SystemExit("Refusing to wipe production without --yes")

    if not yes:
        raise SystemExit("Refusing to run without --yes (destructive).")

    tables = _table_names()
    if not tables:
        raise SystemExit("No tables found in metadata.")

    quoted = ", ".join(f'"{name}"' for name in tables)
    print(f"Truncating {len(tables)} tables…")

    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))

    db = SessionLocal()
    try:
        university, organization = ensure_default_university_and_org(db)
        print(
            f"Restored defaults: university={university.slug} "
            f"organization={organization.slug}"
        )
    finally:
        db.close()

    print("Chapter data wiped. Next: python -m scripts.seed_chapter_owner")


def main() -> None:
    parser = argparse.ArgumentParser(description="Wipe NSA chapter data")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Required confirmation for this destructive operation",
    )
    args = parser.parse_args()
    reset_chapter_data(yes=args.yes)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        raise
