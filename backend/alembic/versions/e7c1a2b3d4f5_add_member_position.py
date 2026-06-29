"""add position column to members

Revision ID: e7c1a2b3d4f5
Revises: d2f8c19a4b03
Create Date: 2026-06-29 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e7c1a2b3d4f5"
down_revision: Union[str, Sequence[str], None] = "d2f8c19a4b03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

memberposition = postgresql.ENUM(
    "president",
    "vice_president",
    "secretary",
    "treasurer",
    "event_manager",
    "public_relations_officer",
    "new_student_representative",
    "member",
    name="memberposition",
    create_type=False,
)


def upgrade() -> None:
    memberposition.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "members",
        sa.Column(
            "position",
            memberposition,
            nullable=False,
            server_default="member",
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "position")
    memberposition.drop(op.get_bind(), checkfirst=True)
