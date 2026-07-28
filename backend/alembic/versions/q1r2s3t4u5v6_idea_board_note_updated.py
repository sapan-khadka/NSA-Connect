"""idea board note last-edited metadata

Revision ID: q1r2s3t4u5v6
Revises: p8k9l0m1n2o3
Create Date: 2026-07-27 15:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "q1r2s3t4u5v6"
down_revision: Union[str, Sequence[str], None] = "p8k9l0m1n2o3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_suggestions",
        sa.Column(
            "board_note_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "event_suggestions",
        sa.Column("board_note_updated_by_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_event_suggestions_board_note_updated_by_id_users",
        "event_suggestions",
        "users",
        ["board_note_updated_by_id"],
        ["id"],
    )
    op.create_index(
        "ix_event_suggestions_board_note_updated_by_id",
        "event_suggestions",
        ["board_note_updated_by_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_event_suggestions_board_note_updated_by_id",
        table_name="event_suggestions",
    )
    op.drop_constraint(
        "fk_event_suggestions_board_note_updated_by_id_users",
        "event_suggestions",
        type_="foreignkey",
    )
    op.drop_column("event_suggestions", "board_note_updated_by_id")
    op.drop_column("event_suggestions", "board_note_updated_at")
