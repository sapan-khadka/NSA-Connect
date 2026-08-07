"""Upload, list, and RAG-index NSA chapter documents."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.member import Member, MemberRole
from app.models.org_document import (
    OrgDocument,
    OrgDocumentChunk,
    OrgDocumentVisibility,
)
from app.schemas.org_document import OrgDocumentResponse
from app.services.constitution_chunk_service import chunk_constitution_text
from app.services.constitution_pdf_service import (
    ConstitutionPdfExtractionError,
    ConstitutionPdfValidationError,
    extract_text_from_constitution_pdf,
)
from app.services.embedding_service import generate_embeddings
from app.services.organization_context import get_default_organization_id
from app.services.receipt_upload_service import (
    ReceiptUploadUnavailableError,
    upload_member_document,
)


class OrgDocumentError(Exception):
    pass


class OrgDocumentNotFoundError(OrgDocumentError):
    pass


class OrgDocumentForbiddenError(OrgDocumentError):
    pass


class OrgDocumentValidationError(OrgDocumentError):
    pass


def _visibility_value(raw: str) -> str:
    cleaned = raw.strip().lower()
    if cleaned not in {
        OrgDocumentVisibility.PUBLIC.value,
        OrgDocumentVisibility.BOARD.value,
    }:
        raise OrgDocumentValidationError("visibility must be public or board")
    return cleaned


def member_can_view_document(member: Member, visibility: str) -> bool:
    if visibility == OrgDocumentVisibility.PUBLIC.value:
        return True
    return member.has_role_at_least(MemberRole.BOARD)


def _to_response(doc: OrgDocument) -> OrgDocumentResponse:
    return OrgDocumentResponse(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        visibility=doc.visibility,  # type: ignore[arg-type]
        file_name=doc.file_name,
        file_url=doc.file_url,
        content_type=doc.content_type,
        page_count=doc.page_count,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        uploaded_by_id=doc.uploaded_by_id,
        uploaded_by_name=(
            doc.uploaded_by.full_name if doc.uploaded_by is not None else None
        ),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def list_org_documents(db: Session, *, member: Member) -> list[OrgDocumentResponse]:
    org_id = get_default_organization_id(db)
    rows = db.scalars(
        select(OrgDocument)
        .options(joinedload(OrgDocument.uploaded_by))
        .where(OrgDocument.organization_id == org_id)
        .order_by(OrgDocument.created_at.desc()),
    ).unique().all()

    visible = [
        row
        for row in rows
        if member_can_view_document(member, row.visibility)
    ]
    return [_to_response(row) for row in visible]


def get_org_document(db: Session, *, member: Member, document_id: int) -> OrgDocument:
    doc = db.scalar(
        select(OrgDocument)
        .options(joinedload(OrgDocument.uploaded_by))
        .where(OrgDocument.id == document_id),
    )
    if doc is None:
        raise OrgDocumentNotFoundError
    if not member_can_view_document(member, doc.visibility):
        raise OrgDocumentForbiddenError
    return doc


def _truncate_section(section: str | None) -> str | None:
    if section is None:
        return None
    trimmed = section.strip()
    if not trimmed:
        return None
    return trimmed[:255]


def _index_document_chunks(
    db: Session,
    *,
    document: OrgDocument,
    text: str,
) -> int:
    text_chunks = chunk_constitution_text(
        text,
        chunk_size_tokens=settings.CONSTITUTION_CHUNK_SIZE_TOKENS,
        overlap_tokens=settings.CONSTITUTION_CHUNK_OVERLAP_TOKENS,
    )
    if not text_chunks:
        raise OrgDocumentValidationError(
            "Could not extract searchable text from this PDF",
        )

    embeddings = generate_embeddings([chunk.content for chunk in text_chunks])
    db.execute(
        delete(OrgDocumentChunk).where(OrgDocumentChunk.document_id == document.id)
    )

    for text_chunk, embedding in zip(text_chunks, embeddings, strict=True):
        db.add(
            OrgDocumentChunk(
                organization_id=document.organization_id,
                document_id=document.id,
                visibility=document.visibility,
                section=_truncate_section(text_chunk.section),
                chunk_index=text_chunk.chunk_index,
                content=text_chunk.content,
                embedding=embedding,
            )
        )

    document.chunk_count = len(text_chunks)
    document.updated_at = datetime.now(UTC)
    return len(text_chunks)


def create_org_document(
    db: Session,
    *,
    actor: Member,
    title: str,
    description: str | None,
    visibility: str,
    file_bytes: bytes,
    content_type: str | None,
    filename: str | None,
) -> OrgDocumentResponse:
    if not actor.has_role_at_least(MemberRole.BOARD):
        raise OrgDocumentForbiddenError

    vis = _visibility_value(visibility)
    cleaned_title = title.strip()
    if not cleaned_title:
        raise OrgDocumentValidationError("title is required")

    try:
        extract = extract_text_from_constitution_pdf(
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
        )
    except ConstitutionPdfValidationError as exc:
        raise OrgDocumentValidationError(str(exc)) from exc
    except ConstitutionPdfExtractionError as exc:
        raise OrgDocumentValidationError(str(exc)) from exc

    file_url: str | None = None
    public_id: str | None = None
    resource_type: str | None = None
    try:
        uploaded = upload_member_document(
            file_bytes=file_bytes,
            content_type=content_type or "application/pdf",
        )
        file_url = uploaded.receipt_url
        public_id = uploaded.public_id
        resource_type = uploaded.resource_type
    except ReceiptUploadUnavailableError:
        # Local/dev without Cloudinary still indexes text for AI.
        file_url = None
    except Exception:
        file_url = None

    org_id = get_default_organization_id(db)
    doc = OrgDocument(
        organization_id=org_id,
        title=cleaned_title,
        description=(description or "").strip() or None,
        visibility=vis,
        file_name=extract.filename or filename or "document.pdf",
        file_url=file_url,
        content_type=content_type or "application/pdf",
        cloudinary_public_id=public_id,
        cloudinary_resource_type=resource_type,
        page_count=extract.page_count,
        char_count=extract.char_count,
        chunk_count=0,
        uploaded_by_id=actor.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.flush()

    _index_document_chunks(db, document=doc, text=extract.text)
    db.commit()
    loaded = get_org_document(db, member=actor, document_id=doc.id)
    return _to_response(loaded)


def update_org_document(
    db: Session,
    *,
    actor: Member,
    document_id: int,
    title: str | None = None,
    description: str | None = None,
    visibility: str | None = None,
) -> OrgDocumentResponse:
    if not actor.has_role_at_least(MemberRole.BOARD):
        raise OrgDocumentForbiddenError

    doc = db.get(OrgDocument, document_id)
    if doc is None:
        raise OrgDocumentNotFoundError

    if title is not None:
        cleaned = title.strip()
        if not cleaned:
            raise OrgDocumentValidationError("title is required")
        doc.title = cleaned
    if description is not None:
        doc.description = description.strip() or None
    if visibility is not None:
        new_vis = _visibility_value(visibility)
        if new_vis != doc.visibility:
            doc.visibility = new_vis
            db.execute(
                OrgDocumentChunk.__table__.update()
                .where(OrgDocumentChunk.document_id == doc.id)
                .values(visibility=new_vis)
            )

    doc.updated_at = datetime.now(UTC)
    db.commit()
    loaded = get_org_document(db, member=actor, document_id=doc.id)
    return _to_response(loaded)


def delete_org_document(db: Session, *, actor: Member, document_id: int) -> None:
    if not actor.has_role_at_least(MemberRole.BOARD):
        raise OrgDocumentForbiddenError
    doc = db.get(OrgDocument, document_id)
    if doc is None:
        raise OrgDocumentNotFoundError
    db.delete(doc)
    db.commit()


@dataclass(frozen=True)
class OrgDocumentSearchHit:
    id: int
    document_id: int
    document_title: str
    visibility: str
    chunk_index: int
    section: str | None
    content: str
    similarity_score: float


def search_org_document_chunks(
    db: Session,
    *,
    member: Member,
    query: str,
    limit: int = 5,
) -> list[OrgDocumentSearchHit]:
    """Semantic search over chapter documents the member may read."""
    import math

    result_limit = max(1, min(limit, 20))
    query_embedding = generate_embeddings([query.strip()])[0]
    org_id = get_default_organization_id(db)
    is_board = member.has_role_at_least(MemberRole.BOARD)

    visibility_filter = [OrgDocumentVisibility.PUBLIC.value]
    if is_board:
        visibility_filter.append(OrgDocumentVisibility.BOARD.value)

    if db.get_bind().dialect.name == "postgresql":
        distance = OrgDocumentChunk.embedding.cosine_distance(query_embedding).label(
            "distance",
        )
        rows = db.execute(
            select(OrgDocumentChunk, OrgDocument, distance)
            .join(OrgDocument, OrgDocument.id == OrgDocumentChunk.document_id)
            .where(
                OrgDocumentChunk.organization_id == org_id,
                OrgDocumentChunk.visibility.in_(visibility_filter),
            )
            .order_by(distance)
            .limit(result_limit),
        ).all()
        return [
            OrgDocumentSearchHit(
                id=chunk.id,
                document_id=document.id,
                document_title=document.title,
                visibility=chunk.visibility,
                chunk_index=chunk.chunk_index,
                section=chunk.section,
                content=chunk.content,
                similarity_score=max(0.0, 1.0 - float(distance_value)),
            )
            for chunk, document, distance_value in rows
        ]

    chunks = db.execute(
        select(OrgDocumentChunk, OrgDocument)
        .join(OrgDocument, OrgDocument.id == OrgDocumentChunk.document_id)
        .where(
            OrgDocumentChunk.organization_id == org_id,
            OrgDocumentChunk.visibility.in_(visibility_filter),
        )
    ).all()

    def cosine(left: list[float], right: list[float]) -> float:
        dot = sum(a * b for a, b in zip(left, right, strict=True))
        ln = math.sqrt(sum(v * v for v in left))
        rn = math.sqrt(sum(v * v for v in right))
        if ln == 0.0 or rn == 0.0:
            return 0.0
        return dot / (ln * rn)

    ranked = sorted(
        chunks,
        key=lambda pair: cosine(query_embedding, list(pair[0].embedding)),
        reverse=True,
    )[:result_limit]

    return [
        OrgDocumentSearchHit(
            id=chunk.id,
            document_id=document.id,
            document_title=document.title,
            visibility=chunk.visibility,
            chunk_index=chunk.chunk_index,
            section=chunk.section,
            content=chunk.content,
            similarity_score=cosine(query_embedding, list(chunk.embedding)),
        )
        for chunk, document in ranked
    ]
