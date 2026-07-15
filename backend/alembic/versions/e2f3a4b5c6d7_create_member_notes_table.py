"""create member notes table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-14 23:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "member_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
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
        sa.ForeignKeyConstraint(["author_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_member_notes_id"), "member_notes", ["id"])
    op.create_index(
        op.f("ix_member_notes_member_id"),
        "member_notes",
        ["member_id"],
    )
    op.create_index(
        op.f("ix_member_notes_author_id"),
        "member_notes",
        ["author_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_member_notes_author_id"), table_name="member_notes")
    op.drop_index(op.f("ix_member_notes_member_id"), table_name="member_notes")
    op.drop_index(op.f("ix_member_notes_id"), table_name="member_notes")
    op.drop_table("member_notes")
