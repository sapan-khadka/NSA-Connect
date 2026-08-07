"""create org_documents and org_document_chunks

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-08-07 11:05:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "y9z0a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "x8y9z0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id"),
            server_default="1",
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_url", sa.String(length=1024), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("cloudinary_public_id", sa.String(length=512), nullable=True),
        sa.Column("cloudinary_resource_type", sa.String(length=32), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("char_count", sa.Integer(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_org_documents_id"), "org_documents", ["id"], unique=False)
    op.create_index(
        op.f("ix_org_documents_organization_id"),
        "org_documents",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_org_documents_uploaded_by_id"),
        "org_documents",
        ["uploaded_by_id"],
        unique=False,
    )

    op.create_table(
        "org_document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id"),
            server_default="1",
            nullable=False,
        ),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("section", sa.String(length=255), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["org_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_org_document_chunks_doc_index",
        ),
    )
    op.create_index(
        op.f("ix_org_document_chunks_id"),
        "org_document_chunks",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_org_document_chunks_organization_id"),
        "org_document_chunks",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_org_document_chunks_document_id"),
        "org_document_chunks",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_org_document_chunks_document_id"),
        table_name="org_document_chunks",
    )
    op.drop_index(
        op.f("ix_org_document_chunks_organization_id"),
        table_name="org_document_chunks",
    )
    op.drop_index(op.f("ix_org_document_chunks_id"), table_name="org_document_chunks")
    op.drop_table("org_document_chunks")
    op.drop_index(op.f("ix_org_documents_uploaded_by_id"), table_name="org_documents")
    op.drop_index(op.f("ix_org_documents_organization_id"), table_name="org_documents")
    op.drop_index(op.f("ix_org_documents_id"), table_name="org_documents")
    op.drop_table("org_documents")
