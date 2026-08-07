"""Org document library models — chapter files (public or board-only) with RAG chunks."""

from datetime import UTC, datetime
from enum import Enum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.embedding import EMBEDDING_DIMENSION
from app.models.base import Base


class OrgDocumentVisibility(str, Enum):
    PUBLIC = "public"  # all approved members
    BOARD = "board"  # board+ only


class OrgDocument(Base):
    """Important NSA chapter document (constitution, policies, guides, etc.)."""

    __tablename__ = "org_documents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(String(20), nullable=False, default=OrgDocumentVisibility.PUBLIC.value)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(1024), nullable=True)
    content_type = Column(String(128), nullable=True)
    cloudinary_public_id = Column(String(512), nullable=True)
    cloudinary_resource_type = Column(String(32), nullable=True)
    page_count = Column(Integer, nullable=True)
    char_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)
    uploaded_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    uploaded_by = relationship("Member", foreign_keys=[uploaded_by_id])
    chunks = relationship(
        "OrgDocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class OrgDocumentChunk(Base):
    """Embedded text chunks for NSA document search + AI assistant."""

    __tablename__ = "org_document_chunks"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_org_document_chunks_doc_index",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    document_id = Column(
        Integer,
        ForeignKey("org_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalized so search can filter without joining documents.
    visibility = Column(String(20), nullable=False, default=OrgDocumentVisibility.PUBLIC.value)
    section = Column(String(255), nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(EMBEDDING_DIMENSION), nullable=False)

    document = relationship("OrgDocument", back_populates="chunks")
