"""create discussion_rooms and custom_room_id on messages

Revision ID: h6c7d8e9f0a1
Revises: g5b6c7d8e9f0
Create Date: 2026-07-20 09:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h6c7d8e9f0a1"
down_revision: Union[str, Sequence[str], None] = "g5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discussion_rooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "live",
                "rejected",
                "archived",
                name="discussionroomstatus",
            ),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["members.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_discussion_rooms_id"), "discussion_rooms", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_discussion_rooms_status"),
        "discussion_rooms",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_rooms_created_by_id"),
        "discussion_rooms",
        ["created_by_id"],
        unique=False,
    )

    op.create_table(
        "discussion_room_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("owner", "member", name="discussionroommemberrole"),
            server_default="member",
            nullable=False,
        ),
        sa.Column("added_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["added_by_id"], ["members.id"]),
        sa.ForeignKeyConstraint(
            ["member_id"], ["members.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["room_id"], ["discussion_rooms.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_id", "member_id", name="uq_discussion_room_member"),
    )
    op.create_index(
        op.f("ix_discussion_room_members_id"),
        "discussion_room_members",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_members_room_id"),
        "discussion_room_members",
        ["room_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discussion_room_members_member_id"),
        "discussion_room_members",
        ["member_id"],
        unique=False,
    )

    op.add_column(
        "discussion_messages",
        sa.Column("custom_room_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_discussion_messages_custom_room_id"),
        "discussion_messages",
        ["custom_room_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_discussion_messages_custom_room_id",
        "discussion_messages",
        "discussion_rooms",
        ["custom_room_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_discussion_messages_room_scope",
        "discussion_messages",
        "NOT (event_id IS NOT NULL AND custom_room_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_discussion_messages_room_scope",
        "discussion_messages",
        type_="check",
    )
    op.drop_constraint(
        "fk_discussion_messages_custom_room_id",
        "discussion_messages",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_discussion_messages_custom_room_id"),
        table_name="discussion_messages",
    )
    op.drop_column("discussion_messages", "custom_room_id")

    op.drop_index(
        op.f("ix_discussion_room_members_member_id"),
        table_name="discussion_room_members",
    )
    op.drop_index(
        op.f("ix_discussion_room_members_room_id"),
        table_name="discussion_room_members",
    )
    op.drop_index(
        op.f("ix_discussion_room_members_id"),
        table_name="discussion_room_members",
    )
    op.drop_table("discussion_room_members")

    op.drop_index(
        op.f("ix_discussion_rooms_created_by_id"),
        table_name="discussion_rooms",
    )
    op.drop_index(op.f("ix_discussion_rooms_status"), table_name="discussion_rooms")
    op.drop_index(op.f("ix_discussion_rooms_id"), table_name="discussion_rooms")
    op.drop_table("discussion_rooms")

    sa.Enum(name="discussionroommemberrole").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="discussionroomstatus").drop(op.get_bind(), checkfirst=True)
