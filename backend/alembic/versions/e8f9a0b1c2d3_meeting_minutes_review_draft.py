"""Add a review draft beside published meeting minutes.

Existing summary, key_decisions, and action_items stay the official record.
Rows that already have a summary keep it and gain a publication timestamp.
Nothing in this migration clears or unpublishes those rows.

Revision ID: e8f9a0b1c2d3
Revises: c6d7e8f9a0b1
Create Date: 2026-11-25 21:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meeting_records", sa.Column("draft_summary", sa.Text(), nullable=True))
    op.add_column(
        "meeting_records",
        sa.Column("draft_key_decisions", sa.JSON(), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("draft_action_items", sa.JSON(), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("draft_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("draft_updated_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("draft_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "meeting_records",
        sa.Column("published_fingerprint", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_meeting_records_draft_updated_by_id",
        "meeting_records",
        "users",
        ["draft_updated_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text(
            """
            UPDATE meeting_records
            SET published_at = updated_at
            WHERE summary IS NOT NULL
              AND trim(summary) <> ''
              AND published_at IS NULL
            """
        )
    )
    _backfill_published_fingerprints()


def _backfill_published_fingerprints() -> None:
    import json

    from app.services.minutes_fingerprint import published_minutes_fingerprint

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, summary, key_decisions, action_items
            FROM meeting_records
            WHERE summary IS NOT NULL AND trim(summary) <> ''
            """
        )
    ).mappings()
    for row in rows:
        decisions = _json_list(row["key_decisions"], json)
        items = _json_list(row["action_items"], json)
        fingerprint = published_minutes_fingerprint(row["summary"], decisions, items)
        connection.execute(
            sa.text(
                """
                UPDATE meeting_records
                SET published_fingerprint = :fingerprint
                WHERE id = :record_id
                """
            ),
            {"fingerprint": fingerprint, "record_id": row["id"]},
        )


def _json_list(value, json_module):
    if value is None or value == "":
        return []
    if isinstance(value, str):
        value = json_module.loads(value)
    return value if isinstance(value, list) else []


def downgrade() -> None:
    op.drop_constraint(
        "fk_meeting_records_draft_updated_by_id",
        "meeting_records",
        type_="foreignkey",
    )
    op.drop_column("meeting_records", "published_fingerprint")
    op.drop_column("meeting_records", "published_at")
    op.drop_column("meeting_records", "draft_version")
    op.drop_column("meeting_records", "draft_updated_by_id")
    op.drop_column("meeting_records", "draft_updated_at")
    op.drop_column("meeting_records", "draft_action_items")
    op.drop_column("meeting_records", "draft_key_decisions")
    op.drop_column("meeting_records", "draft_summary")
