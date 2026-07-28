"""add community/board channel to idea comments

Revision ID: l4g5h6i7j8k9
Revises: k3f4a5b6c7d8
Create Date: 2026-07-26 14:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l4g5h6i7j8k9"
down_revision: Union[str, Sequence[str], None] = "k3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE eventsuggestioncommentchannel AS ENUM ('community', 'board');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.add_column(
        "event_suggestion_comments",
        sa.Column(
            "channel",
            sa.Enum(
                "community",
                "board",
                name="eventsuggestioncommentchannel",
                create_type=False,
            ),
            nullable=False,
            server_default="community",
        ),
    )
    op.create_index(
        op.f("ix_event_suggestion_comments_channel"),
        "event_suggestion_comments",
        ["channel"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_suggestion_comments_channel"),
        table_name="event_suggestion_comments",
    )
    op.drop_column("event_suggestion_comments", "channel")
    op.execute("DROP TYPE IF EXISTS eventsuggestioncommentchannel")
