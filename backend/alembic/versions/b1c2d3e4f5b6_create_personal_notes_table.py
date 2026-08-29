"""create personal notes table

Revision ID: b1c2d3e4f5b6
Revises: ac3d4e5f6a7b
Create Date: 2026-08-29 21:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5b6"
down_revision: Union[str, Sequence[str], None] = "ac3d4e5f6a7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column(
            "pinned",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_personal_notes_id"), "personal_notes", ["id"])
    op.create_index(
        op.f("ix_personal_notes_owner_id"),
        "personal_notes",
        ["owner_id"],
    )
    op.create_index(
        op.f("ix_personal_notes_event_id"),
        "personal_notes",
        ["event_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_personal_notes_event_id"), table_name="personal_notes")
    op.drop_index(op.f("ix_personal_notes_owner_id"), table_name="personal_notes")
    op.drop_index(op.f("ix_personal_notes_id"), table_name="personal_notes")
    op.drop_table("personal_notes")
