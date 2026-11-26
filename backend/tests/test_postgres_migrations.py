"""Verify Alembic migrations against a live PostgreSQL database."""

import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from unittest.mock import patch

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import engine
from app.services.meeting_service import (
    MeetingDraftConflictError,
    MeetingDraftRequiredError,
    publish_meeting_minutes,
    save_minutes_draft,
)
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


def test_pr9_migration_is_the_only_head():
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    assert set(script.get_heads()) == {"e8f9a0b1c2d3"}


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


def _insert_event(connection, *, user_id: int, organization_id: int, title: str) -> int:
    return connection.execute(
        text(
            """
            INSERT INTO events (
                title, description, event_type, starts_at, budget,
                created_by_id, organization_id, show_in_photo_archive
            )
            VALUES (
                :title, 'Agenda', 'meeting',
                '2026-11-20T18:00:00Z', 0, :user_id, :organization_id, true
            )
            RETURNING id
            """
        ),
        {"title": title, "user_id": user_id, "organization_id": organization_id},
    ).scalar_one()


def _insert_minutes(
    connection,
    *,
    event_id: int,
    raw_notes: str,
    summary: str | None,
    decisions: str,
    items: str,
) -> None:
    connection.execute(
        text(
            """
            INSERT INTO meeting_records (
                event_id, raw_notes, summary, key_decisions, action_items, updated_at
            )
            VALUES (
                :event_id, :raw_notes, :summary,
                CAST(:decisions AS json), CAST(:items AS json),
                '2026-11-20T19:00:00Z'
            )
            """
        ),
        {
            "event_id": event_id,
            "raw_notes": raw_notes,
            "summary": summary,
            "decisions": decisions,
            "items": items,
        },
    )


class _MinutesActor:
    def __init__(self, user_id: int, organization_id: int) -> None:
        self.id = user_id
        self._active_organization_id = organization_id


def _run_concurrent_minutes(database_url: str, user_id: int, organization_id: int) -> None:
    """Two PostgreSQL sessions race a draft save and a publication."""
    scratch = create_engine(database_url)
    factory = sessionmaker(bind=scratch)
    actor = _MinutesActor(user_id, organization_id)
    session = factory()
    save_event = _insert_event(
        session,
        user_id=user_id,
        organization_id=organization_id,
        title="Concurrent draft meeting",
    )
    publish_event = _insert_event(
        session,
        user_id=user_id,
        organization_id=organization_id,
        title="Concurrent publish meeting",
    )
    _insert_minutes(
        session,
        event_id=save_event,
        raw_notes="Concurrent draft notes.",
        summary=None,
        decisions="[]",
        items="[]",
    )
    _insert_minutes(
        session,
        event_id=publish_event,
        raw_notes="Concurrent publish notes.",
        summary="Already published overview.",
        decisions="[]",
        items="[]",
    )
    session.execute(
        text(
            """
            UPDATE meeting_records
            SET draft_summary = 'Starting draft.',
                draft_key_decisions = CAST('[]' AS json),
                draft_action_items = CAST('[]' AS json),
                draft_version = 1
            WHERE event_id = :event_id
            """
        ),
        {"event_id": save_event},
    )
    session.execute(
        text(
            """
            UPDATE meeting_records
            SET draft_summary = 'Concurrent published overview.',
                draft_key_decisions = CAST('[]' AS json),
                draft_action_items = CAST('[]' AS json),
                draft_version = 1,
                published_at = updated_at
            WHERE event_id = :event_id
            """
        ),
        {"event_id": publish_event},
    )
    session.commit()
    session.close()

    save_outcomes: list[str] = []
    publish_outcomes: list[str] = []
    save_barrier = threading.Barrier(2)
    publish_barrier = threading.Barrier(2)

    def save_draft(summary: str) -> None:
        db = factory()
        try:
            save_barrier.wait(timeout=10)
            try:
                save_minutes_draft(
                    db,
                    save_event,
                    summary=summary,
                    key_decisions=[],
                    action_items=[],
                    base_draft_version=1,
                    updated_by=actor,
                )
                save_outcomes.append("saved")
            except MeetingDraftConflictError:
                save_outcomes.append("conflict")
            except Exception as exc:
                save_outcomes.append(f"error:{type(exc).__name__}:{exc}")
        finally:
            db.close()

    def publish() -> None:
        db = factory()
        try:
            publish_barrier.wait(timeout=10)
            try:
                publish_meeting_minutes(
                    db,
                    publish_event,
                    base_draft_version=1,
                    updated_by=actor,
                )
                publish_outcomes.append("published")
            except (MeetingDraftConflictError, MeetingDraftRequiredError):
                publish_outcomes.append("rejected")
            except Exception as exc:
                publish_outcomes.append(f"error:{type(exc).__name__}:{exc}")
        finally:
            db.close()

    with patch(
        "app.services.meeting_service.notify_board_of_meeting_update",
        return_value=0,
    ) as notify:
        workers = [
            threading.Thread(target=save_draft, args=("Left draft.",)),
            threading.Thread(target=save_draft, args=("Right draft.",)),
            threading.Thread(target=publish),
            threading.Thread(target=publish),
        ]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(timeout=20)

    check = factory()
    try:
        saved = check.execute(
            text(
                """
                SELECT draft_summary, draft_version, raw_notes
                FROM meeting_records WHERE event_id = :event_id
                """
            ),
            {"event_id": save_event},
        ).one()
        published = check.execute(
            text(
                """
                SELECT summary, draft_version, raw_notes
                FROM meeting_records WHERE event_id = :event_id
                """
            ),
            {"event_id": publish_event},
        ).one()
    finally:
        check.close()
        scratch.dispose()

    assert sorted(save_outcomes) == ["conflict", "saved"]
    assert saved.draft_summary in {"Left draft.", "Right draft."}
    assert saved.draft_version == 2
    assert saved.raw_notes == "Concurrent draft notes."
    assert sorted(publish_outcomes) == ["published", "rejected"]
    assert published.summary == "Concurrent published overview."
    assert published.draft_version is None
    assert published.raw_notes == "Concurrent publish notes."
    assert notify.call_count == 1


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
            _insert_minutes(
                connection,
                event_id=event_id,
                raw_notes="Approved the cultural night budget.",
                summary="The board approved the cultural night budget.",
                decisions='["Approved the cultural night budget."]',
                items='[{"task": "Send the budget", "owner": "Treasurer", "due": null}]',
            )
            empty_summary_event = _insert_event(
                connection,
                user_id=user_id,
                organization_id=organization_id,
                title="Empty summary meeting",
            )
            _insert_minutes(
                connection,
                event_id=empty_summary_event,
                raw_notes="Raw notes for the empty summary.",
                summary="",
                decisions='["Keep this decision text."]',
                items='[{"task": "Keep this task", "owner": null, "due": null}]',
            )
            null_summary_event = _insert_event(
                connection,
                user_id=user_id,
                organization_id=organization_id,
                title="Null summary meeting",
            )
            _insert_minutes(
                connection,
                event_id=null_summary_event,
                raw_notes="Notes with no summary.",
                summary=None,
                decisions="[]",
                items="[]",
            )
            whitespace_event = _insert_event(
                connection,
                user_id=user_id,
                organization_id=organization_id,
                title="Whitespace summary meeting",
            )
            _insert_minutes(
                connection,
                event_id=whitespace_event,
                raw_notes="Whitespace summary notes.",
                summary="   ",
                decisions="[]",
                items="[]",
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
        scratch = create_engine(scratch_url)

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
        with scratch.connect() as connection:
            preserved_rows = {
                record.event_id: record
                for record in connection.execute(
                    text(
                        """
                        SELECT event_id, summary, raw_notes, key_decisions, action_items,
                               draft_summary, draft_version, published_at, published_fingerprint
                        FROM meeting_records
                        """
                    ),
                )
            }
            decisions_nullable = connection.execute(
                text(
                    """
                    SELECT is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'meeting_records' AND column_name = 'key_decisions'
                    """
                ),
            ).scalar_one()
        empty = preserved_rows[empty_summary_event]
        untouched = preserved_rows[null_summary_event]
        blank = preserved_rows[whitespace_event]
        assert empty.summary == ""
        assert empty.raw_notes == "Raw notes for the empty summary."
        assert _json_value(empty.key_decisions) == ["Keep this decision text."]
        assert _json_value(empty.action_items) == [
            {"task": "Keep this task", "owner": None, "due": None}
        ]
        assert empty.published_at is None
        assert empty.published_fingerprint is None
        assert empty.draft_version is None
        assert untouched.summary is None
        assert untouched.raw_notes == "Notes with no summary."
        assert _json_value(untouched.key_decisions) == []
        assert _json_value(untouched.action_items) == []
        assert untouched.published_at is None
        assert blank.summary == "   "
        assert blank.raw_notes == "Whitespace summary notes."
        assert blank.published_at is None
        assert decisions_nullable == "NO"

        with scratch.begin() as connection:
            previous_backend_event = _insert_event(
                connection,
                user_id=user_id,
                organization_id=organization_id,
                title="Previous backend meeting",
            )
            connection.execute(
                text(
                    """
                    INSERT INTO meeting_records (
                        event_id, raw_notes, summary, key_decisions, action_items, updated_at
                    )
                    VALUES (
                        :event_id, 'Notes written by the previous backend.',
                        'Summary written by the previous backend.',
                        CAST('[]' AS json), CAST('[]' AS json),
                        '2026-11-21T00:00:00Z'
                    )
                    """
                ),
                {"event_id": previous_backend_event},
            )
            connection.execute(
                text(
                    """
                    UPDATE meeting_records
                    SET draft_summary = 'Private draft from the new code',
                        draft_version = 3
                    WHERE event_id = :event_id
                    """
                ),
                {"event_id": previous_backend_event},
            )
            connection.execute(
                text(
                    """
                    UPDATE meeting_records
                    SET summary = 'Summary revised by the previous backend'
                    WHERE event_id = :event_id
                    """
                ),
                {"event_id": previous_backend_event},
            )
            compatible = connection.execute(
                text(
                    """
                    SELECT summary, raw_notes, draft_summary, draft_version
                    FROM meeting_records WHERE event_id = :event_id
                    """
                ),
                {"event_id": previous_backend_event},
            ).one()
        assert compatible.summary == "Summary revised by the previous backend"
        assert compatible.raw_notes == "Notes written by the previous backend."
        assert compatible.draft_summary == "Private draft from the new code"
        assert compatible.draft_version == 3

        scratch.dispose()
        _run_concurrent_minutes(rendered, user_id, organization_id)
        scratch = create_engine(scratch_url)

        with scratch.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE meeting_records
                    SET draft_summary = 'Draft that a downgrade would drop',
                        draft_version = 4
                    WHERE event_id = :event_id
                    """
                ),
                {"event_id": event_id},
            )

        scratch.dispose()
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
            empty_after = connection.execute(
                text(
                    """
                    SELECT summary, raw_notes, key_decisions
                    FROM meeting_records WHERE event_id = :event_id
                    """
                ),
                {"event_id": empty_summary_event},
            ).one()
        scratch.dispose()
        assert preserved.summary == "The board approved the cultural night budget."
        assert preserved.raw_notes == "Approved the cultural night budget."
        assert removed is None
        assert empty_after.summary == ""
        assert empty_after.raw_notes == "Raw notes for the empty summary."
        assert _json_value(empty_after.key_decisions) == ["Keep this decision text."]

        _alembic(backend_dir, rendered, "upgrade", "head")
        scratch = create_engine(scratch_url)
        with scratch.connect() as connection:
            restored = connection.execute(
                text(
                    """
                    SELECT summary, raw_notes, draft_summary, published_at
                    FROM meeting_records WHERE event_id = :event_id
                    """
                ),
                {"event_id": event_id},
            ).one()
        scratch.dispose()
        assert restored.summary == "The board approved the cultural night budget."
        assert restored.raw_notes == "Approved the cultural night budget."
        assert restored.published_at is not None
        assert restored.draft_summary is None
    finally:
        _admin_sql(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = 'nsa_minutes_migration_test' AND pid <> pg_backend_pid()"
        )
        _admin_sql(f'DROP DATABASE IF EXISTS "{database_name}"')
        admin.dispose()


def _json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


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
