"""add discussion room kind and dm_pair_key for DMs

Revision ID: a2b3c4d5e6f7
Revises: m1n2o3p4q5r6
Create Date: 2026-07-25 14:45:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "m1n2o3p4q5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

discussionroomkind = sa.Enum("group", "dm", name="discussionroomkind")


def upgrade() -> None:
    discussionroomkind.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "discussion_rooms",
        sa.Column(
            "kind",
            discussionroomkind,
            nullable=False,
            server_default="group",
        ),
    )
    op.add_column(
        "discussion_rooms",
        sa.Column("dm_pair_key", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_discussion_rooms_kind"),
        "discussion_rooms",
        ["kind"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_rooms_dm_pair_key"),
        "discussion_rooms",
        ["dm_pair_key"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_discussion_rooms_org_dm_pair",
        "discussion_rooms",
        ["organization_id", "dm_pair_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_discussion_rooms_org_dm_pair",
        "discussion_rooms",
        type_="unique",
    )
    op.drop_index(op.f("ix_discussion_rooms_dm_pair_key"), table_name="discussion_rooms")
    op.drop_index(op.f("ix_discussion_rooms_kind"), table_name="discussion_rooms")
    op.drop_column("discussion_rooms", "dm_pair_key")
    op.drop_column("discussion_rooms", "kind")
    discussionroomkind.drop(op.get_bind(), checkfirst=True)
