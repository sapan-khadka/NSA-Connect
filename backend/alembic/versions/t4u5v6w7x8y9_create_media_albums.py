"""create media_albums and media_album_items

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-07-29 19:55:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t4u5v6w7x8y9"
down_revision: Union[str, Sequence[str], None] = "s3t4u5v6w7x8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_albums",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_media_albums_id"), "media_albums", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_media_albums_organization_id"),
        "media_albums",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_media_albums_created_by_id"),
        "media_albums",
        ["created_by_id"],
        unique=False,
    )

    op.create_table(
        "media_album_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("album_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=False),
        sa.Column("public_id", sa.String(length=512), nullable=False),
        sa.Column(
            "media_kind",
            sa.String(length=16),
            server_default="photo",
            nullable=False,
        ),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["album_id"], ["media_albums.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_media_album_items_id"), "media_album_items", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_media_album_items_album_id"),
        "media_album_items",
        ["album_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_media_album_items_uploaded_by_id"),
        "media_album_items",
        ["uploaded_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_media_album_items_uploaded_by_id"), table_name="media_album_items"
    )
    op.drop_index(op.f("ix_media_album_items_album_id"), table_name="media_album_items")
    op.drop_index(op.f("ix_media_album_items_id"), table_name="media_album_items")
    op.drop_table("media_album_items")
    op.drop_index(op.f("ix_media_albums_created_by_id"), table_name="media_albums")
    op.drop_index(op.f("ix_media_albums_organization_id"), table_name="media_albums")
    op.drop_index(op.f("ix_media_albums_id"), table_name="media_albums")
    op.drop_table("media_albums")
