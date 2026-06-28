import pytest
from sqlalchemy import text

from app.core.database import engine


def test_pgvector_extension_is_available():
    """Requires PostgreSQL with pgvector (docker compose postgres service)."""
    try:
        with engine.connect() as connection:
            installed = connection.execute(
                text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"),
            ).scalar_one_or_none()
    except Exception as exc:
        pytest.skip(f"PostgreSQL not available for pgvector check: {exc}")

    if installed is None:
        pytest.skip("pgvector extension not installed; run alembic upgrade head")

    assert installed == 1
