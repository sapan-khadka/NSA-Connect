"""Verify Alembic migrations against a live PostgreSQL database."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from app.core.config import settings
from app.core.database import engine
from app.services.minutes_fingerprint import published_minutes_fingerprint

HOT_PATH_INDEXES: tuple[tuple[str, str], ...] = (
    ("events", "ix_events_starts_at"),
    ("event_tasks", "ix_event_tasks_event_id"),
    ("event_tasks", "ix_event_tasks_assignee_id"),
    ("finance_entries", "ix_finance_entries_event_id"),
    ("finance_entries", "ix_finance_entries_created_at"),
    ("volunteer_slots", "ix_volunteer_slots_event_id"),
    ("event_rsvps", "ix_event_rsvps_event_id"),
    ("event_rsvps", "ix_event_rsvps_member_id"),
    ("meeting_attendance", "ix_meeting_attendance_event_id"),
    ("meeting_attendance", "ix_meeting_attendance_member_id"),
    ("announcements", "ix_announcements_created_at"),
)

def _alembic_head() -> str:
    """Resolve the migration head from the checked-in Alembic scripts."""
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    return script.get_current_head()



def _require_postgres() -> None:
    url = str(engine.url)
    if not url.startswith("postgresql"):
        pytest.skip(f"PostgreSQL required; DATABASE_URL is {url}")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def test_hot_path_indexes_exist_after_migrations():
    """Run `alembic upgrade head` in CI before this test."""
    _require_postgres()

    try:
        with engine.connect() as connection:
            missing: list[str] = []
            for table_name, index_name in HOT_PATH_INDEXES:
                found = connection.execute(
                    text(
                        "SELECT 1 FROM pg_indexes "
                        "WHERE tablename = :table_name AND indexname = :index_name"
                    ),
                    {"table_name": table_name, "index_name": index_name},
                ).scalar_one_or_none()
                if found is None:
                    missing.append(f"{table_name}.{index_name}")

            revision = connection.execute(
                text("SELECT version_num FROM alembic_version"),
            ).scalar_one_or_none()
    except Exception as exc:
        pytest.fail(f"PostgreSQL migration verification failed: {exc}")

    assert revision == _alembic_head(), (
        "Database is not at Alembic head; run `alembic upgrade head`"
    )
    assert missing == [], f"Missing indexes after migrations: {', '.join(missing)}"


def test_pgvector_extension_is_available():
    """Requires PostgreSQL with pgvector (same service as migrations CI job)."""
    _require_postgres()

    try:
        with engine.connect() as connection:
            installed = connection.execute(
                text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"),
            ).scalar_one_or_none()
    except Exception as exc:
        pytest.fail(f"PostgreSQL pgvector check failed: {exc}")

    assert installed == 1, "pgvector extension not installed; run `alembic upgrade head`"


_DRAFT_COLUMNS = (
    "draft_summary",
    "draft_key_decisions",
    "draft_action_items",
    "draft_updated_at",
    "draft_updated_by_id",
    "draft_version",
    "published_at",
    "published_fingerprint",
)


def test_meeting_minutes_draft_columns_are_nullable_additions():
    """New columns sit beside published minutes and do not replace them."""
    _require_postgres()

    with engine.connect() as connection:
        revision = connection.execute(
            text("SELECT version_num FROM alembic_version"),
        ).scalar_one_or_none()
        if revision != _alembic_head():
            pytest.skip("database is not at Alembic head")
        rows = [
            row
            for row in connection.execute(
                text(
                    """
                    SELECT column_name, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'meeting_records'
                    """
                ),
            ).all()
            if row.column_name in _DRAFT_COLUMNS
        ]
        summary = connection.execute(
            text(
                """
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = 'meeting_records' AND column_name = 'summary'
                """
            ),
        ).scalar_one()

    found = {name: nullable for name, nullable in rows}
    assert set(found) == set(_DRAFT_COLUMNS)
    assert all(nullable == "YES" for nullable in found.values())
    assert summary == "YES"


def test_meeting_minutes_migration_preserves_published_records():
    """Upgrade and downgrade on a scratch database, never the caller's database."""
    if os.environ.get("CI") != "true" and os.environ.get("RUN_MIGRATION_CYCLE") != "1":
        pytest.skip("set RUN_MIGRATION_CYCLE=1 to run the scratch-database migration cycle")

    admin_url = make_url(os.environ.get("DATABASE_URL") or settings.DATABASE_URL)
    if not admin_url.drivername.startswith("postgresql"):
        pytest.skip("PostgreSQL required for the migration cycle")

    database_name = "nsa_minutes_migration_test"
    scratch_url = admin_url.set(database=database_name)
    admin = create_engine(admin_url.set(database="postgres"), isolation_level="AUTOCOMMIT")

    def _admin_sql(statement: str) -> None:
        with admin.connect() as connection:
            connection.exec_driver_sql(statement)

    try:
        _admin_sql(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = 'nsa_minutes_migration_test' AND pid <> pg_backend_pid()"
        )
        _admin_sql(f'DROP DATABASE IF EXISTS "{database_name}"')
        _admin_sql(f'CREATE DATABASE "{database_name}" TEMPLATE template0')
    except Exception as exc:
        admin.dispose()
        pytest.skip(f"could not create a scratch database: {exc}")

    backend_dir = Path(__file__).resolve().parents[1]
    previous = "c6d7e8f9a0b1"
    try:
        rendered = scratch_url.render_as_string(hide_password=False)
        _alembic(backend_dir, rendered, "upgrade", previous)
        scratch = create_engine(scratch_url)
        with scratch.begin() as connection:
            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users (
                        full_name, email, major, graduation_year, hashed_password,
                        role, status, token_version
                    )
                    VALUES (
                        'Minutes Keeper', 'minutes-migration@semo.edu', 'Computer Science',
                        2028, 'not-a-password', 'general', 'approved', 1
                    )
                    RETURNING id
                    """
                ),
            ).scalar_one()
            organization_id = connection.execute(
                text("SELECT id FROM organizations ORDER BY id LIMIT 1"),
            ).scalar_one()
            event_id = connection.execute(
                text(
                    """
                    INSERT INTO events (
                        title, description, event_type, starts_at, budget,
                        created_by_id, organization_id, show_in_photo_archive
                    )
                    VALUES (
                        'Legacy board meeting', 'Agenda', 'meeting',
                        '2026-11-20T18:00:00Z', 0, :user_id, :organization_id, true
                    )
                    RETURNING id
                    """
                ),
                {"user_id": user_id, "organization_id": organization_id},
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO meeting_records (
                        event_id, raw_notes, summary, key_decisions, action_items, updated_at
                    )
                    VALUES (
                        :event_id,
                        'Approved the cultural night budget.',
                        'The board approved the cultural night budget.',
                        CAST(:decisions AS json),
                        CAST(:items AS json),
                        '2026-11-20T19:00:00Z'
                    )
                    """
                ),
                {
                    "event_id": event_id,
                    "decisions": '["Approved the cultural night budget."]',
                    "items": '[{"task": "Send the budget", "owner": "Treasurer", "due": null}]',
                },
            )
        scratch.dispose()

        _alembic(backend_dir, rendered, "upgrade", "head")
        scratch = create_engine(scratch_url)
        with scratch.connect() as connection:
            row = connection.execute(
                text(
                    """
                    SELECT summary, raw_notes, draft_summary, draft_version, published_at,
                           published_fingerprint
                    FROM meeting_records
                    WHERE event_id = :event_id
                    """
                ),
                {"event_id": event_id},
            ).one()
            nullable = connection.execute(
                text(
                    """
                    SELECT is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'meeting_records' AND column_name = 'draft_summary'
                    """
                ),
            ).scalar_one()
        scratch.dispose()

        assert row.summary == "The board approved the cultural night budget."
        assert row.raw_notes == "Approved the cultural night budget."
        assert row.draft_summary is None
        assert row.draft_version is None
        assert row.published_at is not None
        assert nullable == "YES"
        assert row.published_fingerprint == published_minutes_fingerprint(
            row.summary,
            ["Approved the cultural night budget."],
            [{"task": "Send the budget", "owner": "Treasurer", "due": None}],
        )

        _alembic(backend_dir, rendered, "downgrade", previous)
        scratch = create_engine(scratch_url)
        with scratch.connect() as connection:
            preserved = connection.execute(
                text("SELECT summary, raw_notes FROM meeting_records WHERE event_id = :event_id"),
                {"event_id": event_id},
            ).one()
            removed = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'meeting_records' AND column_name = 'draft_summary'
                    """
                ),
            ).scalar_one_or_none()
        scratch.dispose()
        assert preserved.summary == "The board approved the cultural night budget."
        assert preserved.raw_notes == "Approved the cultural night budget."
        assert removed is None

        _alembic(backend_dir, rendered, "upgrade", "head")
    finally:
        _admin_sql(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = 'nsa_minutes_migration_test' AND pid <> pg_backend_pid()"
        )
        _admin_sql(f'DROP DATABASE IF EXISTS "{database_name}"')
        admin.dispose()


def _alembic(backend_dir: Path, database_url: str, command: str, revision: str) -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", command, revision],
        cwd=backend_dir,
        env={**os.environ, "DATABASE_URL": database_url},
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        output = f"{completed.stdout}\n{completed.stderr}".replace(database_url, "postgresql://redacted")
        pytest.fail(output[-2000:])
