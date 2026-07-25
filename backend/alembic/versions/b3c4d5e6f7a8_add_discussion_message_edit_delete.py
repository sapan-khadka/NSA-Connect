"""add discussion message edited_at and deleted_at

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-25 15:55:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "discussion_messages",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "discussion_messages",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_discussion_messages_deleted_at"),
        "discussion_messages",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discussion_messages_deleted_at"),
        table_name="discussion_messages",
    )
    op.drop_column("discussion_messages", "deleted_at")
    op.drop_column("discussion_messages", "edited_at")
