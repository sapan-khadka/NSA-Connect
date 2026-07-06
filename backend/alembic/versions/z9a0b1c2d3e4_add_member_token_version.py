"""add member token_version for JWT revocation

Revision ID: z9a0b1c2d3e4
Revises: y8z9a0b1c2d3
Create Date: 2026-07-06 14:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "y8z9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("members", "token_version", server_default=None)


def downgrade() -> None:
    op.drop_column("members", "token_version")
