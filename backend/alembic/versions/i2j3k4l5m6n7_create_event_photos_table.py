"""create event photos table

Revision ID: i2j3k4l5m6n7
Revises: h1a2b3c4d5e6
Create Date: 2026-06-29 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i2j3k4l5m6n7"
down_revision: Union[str, Sequence[str], None] = "h1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=False),
        sa.Column("public_id", sa.String(length=512), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_event_photos_event_id"), "event_photos", ["event_id"])
    op.create_index(
        op.f("ix_event_photos_uploaded_by_id"),
        "event_photos",
        ["uploaded_by_id"],
    )
    op.create_index(op.f("ix_event_photos_id"), "event_photos", ["id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_event_photos_id"), table_name="event_photos")
    op.drop_index(op.f("ix_event_photos_uploaded_by_id"), table_name="event_photos")
    op.drop_index(op.f("ix_event_photos_event_id"), table_name="event_photos")
    op.drop_table("event_photos")
