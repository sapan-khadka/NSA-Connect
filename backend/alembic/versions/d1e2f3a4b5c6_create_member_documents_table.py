"""create member documents table

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-07-14 21:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "member_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("file_url", sa.String(length=2048), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("document_type", sa.String(length=32), nullable=False),
        sa.Column("public_id", sa.String(length=512), nullable=False),
        sa.Column(
            "resource_type",
            sa.String(length=32),
            server_default="image",
            nullable=False,
        ),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_member_documents_id"), "member_documents", ["id"])
    op.create_index(
        op.f("ix_member_documents_member_id"),
        "member_documents",
        ["member_id"],
    )
    op.create_index(
        op.f("ix_member_documents_uploaded_by_id"),
        "member_documents",
        ["uploaded_by_id"],
    )
    op.create_index(
        op.f("ix_member_documents_document_type"),
        "member_documents",
        ["document_type"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_member_documents_document_type"),
        table_name="member_documents",
    )
    op.drop_index(
        op.f("ix_member_documents_uploaded_by_id"),
        table_name="member_documents",
    )
    op.drop_index(
        op.f("ix_member_documents_member_id"),
        table_name="member_documents",
    )
    op.drop_index(op.f("ix_member_documents_id"), table_name="member_documents")
    op.drop_table("member_documents")
