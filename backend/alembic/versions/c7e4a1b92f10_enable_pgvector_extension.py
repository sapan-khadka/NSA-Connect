"""enable pgvector extension

Revision ID: c7e4a1b92f10
Revises: f3a1b2c94d08
Create Date: 2026-06-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "c7e4a1b92f10"
down_revision: Union[str, Sequence[str], None] = "f3a1b2c94d08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
