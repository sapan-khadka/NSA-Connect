"""add member networking profile fields and event participant invitations

Revision ID: m6n7o8p9q0r2
Revises: l5m6n7o8p9q1
Create Date: 2026-07-04 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "m6n7o8p9q0r2"
down_revision: Union[str, Sequence[str], None] = "l5m6n7o8p9q1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

profile_field_visibility = postgresql.ENUM(
    "public",
    "board_only",
    name="profilefieldvisibility",
    create_type=False,
)


def upgrade() -> None:
    profile_field_visibility.create(op.get_bind(), checkfirst=True)

    op.add_column("members", sa.Column("interests", sa.Text(), nullable=True))
    op.add_column("members", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column(
        "members",
        sa.Column(
            "talents",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column("members", sa.Column("talent_other", sa.String(length=255), nullable=True))
    op.add_column("members", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column(
        "members",
        sa.Column("social_handle", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "members",
        sa.Column(
            "email_visibility",
            profile_field_visibility,
            nullable=False,
            server_default="public",
        ),
    )
    op.add_column(
        "members",
        sa.Column(
            "phone_visibility",
            profile_field_visibility,
            nullable=False,
            server_default="board_only",
        ),
    )
    op.add_column(
        "members",
        sa.Column(
            "social_handle_visibility",
            profile_field_visibility,
            nullable=False,
            server_default="board_only",
        ),
    )

    op.create_table(
        "event_participant_invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["invited_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "member_id",
            name="uq_event_participant_invitations_event_member",
        ),
    )
    op.create_index(
        op.f("ix_event_participant_invitations_id"),
        "event_participant_invitations",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_event_participant_invitations_id"),
        table_name="event_participant_invitations",
    )
    op.drop_table("event_participant_invitations")

    op.drop_column("members", "social_handle_visibility")
    op.drop_column("members", "phone_visibility")
    op.drop_column("members", "email_visibility")
    op.drop_column("members", "social_handle")
    op.drop_column("members", "phone")
    op.drop_column("members", "talent_other")
    op.drop_column("members", "talents")
    op.drop_column("members", "bio")
    op.drop_column("members", "interests")

    profile_field_visibility.drop(op.get_bind(), checkfirst=True)
