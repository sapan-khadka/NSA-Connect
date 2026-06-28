"""create constitutional chunks table

Revision ID: d2f8c19a4b03
Revises: c7e4a1b92f10
Create Date: 2026-06-26 16:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

from app.core.embedding import EMBEDDING_DIMENSION

revision: str = "d2f8c19a4b03"
down_revision: Union[str, Sequence[str], None] = "c7e4a1b92f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "constitutional_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=255), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIMENSION), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_constitutional_chunks_id"),
        "constitutional_chunks",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_constitutional_chunks_id"),
        table_name="constitutional_chunks",
    )
    op.drop_table("constitutional_chunks")
