"""create custom board positions catalog

Revision ID: f4a5b6c7d8e9
Revises: e2f3a4b5c6d7
Create Date: 2026-07-18 22:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "custom_board_positions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("name_normalized", sa.String(length=120), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
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
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name_normalized"),
    )
    op.create_index(
        op.f("ix_custom_board_positions_id"),
        "custom_board_positions",
        ["id"],
    )
    op.create_index(
        op.f("ix_custom_board_positions_name_normalized"),
        "custom_board_positions",
        ["name_normalized"],
    )
    op.create_index(
        op.f("ix_custom_board_positions_created_by_id"),
        "custom_board_positions",
        ["created_by_id"],
    )

    op.add_column(
        "members",
        sa.Column("custom_board_position_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_members_custom_board_position_id"),
        "members",
        ["custom_board_position_id"],
        unique=True,
    )
    op.create_foreign_key(
        "fk_members_custom_board_position_id",
        "members",
        "custom_board_positions",
        ["custom_board_position_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_members_custom_board_position_id",
        "members",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_members_custom_board_position_id"),
        table_name="members",
    )
    op.drop_column("members", "custom_board_position_id")

    op.drop_index(
        op.f("ix_custom_board_positions_created_by_id"),
        table_name="custom_board_positions",
    )
    op.drop_index(
        op.f("ix_custom_board_positions_name_normalized"),
        table_name="custom_board_positions",
    )
    op.drop_index(
        op.f("ix_custom_board_positions_id"),
        table_name="custom_board_positions",
    )
    op.drop_table("custom_board_positions")
