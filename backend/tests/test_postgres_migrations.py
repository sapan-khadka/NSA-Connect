"""Verify Alembic migrations against a live PostgreSQL database."""

import pytest
from sqlalchemy import text

from app.core.database import engine

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

ALEMBIC_HEAD = "b1c2d3e4f5b6"


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

    assert revision == ALEMBIC_HEAD, (
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
