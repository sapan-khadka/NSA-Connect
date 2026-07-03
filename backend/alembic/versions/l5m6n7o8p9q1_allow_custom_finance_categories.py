"""allow custom finance entry categories

Revision ID: l5m6n7o8p9q1
Revises: k4l5m6n7o8p0
Create Date: 2026-06-29 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l5m6n7o8p9q1"
down_revision: Union[str, Sequence[str], None] = "k4l5m6n7o8p0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE finance_entries "
        "ALTER COLUMN category TYPE VARCHAR(64) "
        "USING category::text"
    )
    op.execute("DROP TYPE IF EXISTS financecategory")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE financecategory AS ENUM ("
        "'membership_dues', 'fundraising', 'donation', 'sponsorship', "
        "'food_beverage', 'venue', 'supplies', 'marketing', 'travel', "
        "'event', 'other'"
        ")"
    )
    op.execute(
        "ALTER TABLE finance_entries "
        "ALTER COLUMN category TYPE financecategory "
        "USING category::financecategory"
    )
