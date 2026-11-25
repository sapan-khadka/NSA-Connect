"""Store Cloudinary public_id for private finance receipts

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-09-26 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "finance_entries",
        sa.Column("receipt_public_id", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "finance_entries",
        sa.Column("receipt_resource_type", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("finance_entries", "receipt_resource_type")
    op.drop_column("finance_entries", "receipt_public_id")
