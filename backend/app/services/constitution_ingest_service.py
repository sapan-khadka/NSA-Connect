from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.constitutional_chunk import ConstitutionalChunk
from app.services.constitution_chunk_service import (
    ConstitutionTextChunk,
    chunk_constitution_text,
)
from app.services.constitution_pdf_service import (
    ConstitutionPdfExtractResult,
    extract_text_from_constitution_pdf,
)
from app.services.embedding_service import generate_embeddings


@dataclass(frozen=True)
class StoredConstitutionChunk:
    id: int
    chunk_index: int
    section: str | None
    content: str
    token_count: int


@dataclass(frozen=True)
class ConstitutionIngestResult:
    filename: str | None
    page_count: int
    char_count: int
    chunk_size_tokens: int
    overlap_tokens: int
    chunks: list[StoredConstitutionChunk]


def _truncate_section(section: str | None) -> str | None:
    if section is None:
        return None
    trimmed = section.strip()
    if not trimmed:
        return None
    return trimmed[:255]


def store_constitution_chunks(
    db: Session,
    text_chunks: list[ConstitutionTextChunk],
) -> list[StoredConstitutionChunk]:
    embeddings = generate_embeddings([chunk.content for chunk in text_chunks])

    db.execute(delete(ConstitutionalChunk))
    stored: list[StoredConstitutionChunk] = []
    for text_chunk, embedding in zip(text_chunks, embeddings, strict=True):
        row = ConstitutionalChunk(
            section=_truncate_section(text_chunk.section),
            chunk_index=text_chunk.chunk_index,
            content=text_chunk.content,
            embedding=embedding,
        )
        db.add(row)
        db.flush()
        stored.append(
            StoredConstitutionChunk(
                id=row.id,
                chunk_index=row.chunk_index,
                section=row.section,
                content=row.content,
                token_count=text_chunk.token_count,
            )
        )

    db.commit()
    return stored


def ingest_constitution_pdf(
    db: Session,
    *,
    file_bytes: bytes,
    content_type: str | None,
    filename: str | None = None,
) -> ConstitutionIngestResult:
    extract_result: ConstitutionPdfExtractResult = extract_text_from_constitution_pdf(
        file_bytes=file_bytes,
        content_type=content_type,
        filename=filename,
    )
    text_chunks = chunk_constitution_text(
        extract_result.text,
        chunk_size_tokens=settings.CONSTITUTION_CHUNK_SIZE_TOKENS,
        overlap_tokens=settings.CONSTITUTION_CHUNK_OVERLAP_TOKENS,
    )
    stored_chunks = store_constitution_chunks(db, text_chunks)

    return ConstitutionIngestResult(
        filename=extract_result.filename,
        page_count=extract_result.page_count,
        char_count=extract_result.char_count,
        chunk_size_tokens=settings.CONSTITUTION_CHUNK_SIZE_TOKENS,
        overlap_tokens=settings.CONSTITUTION_CHUNK_OVERLAP_TOKENS,
        chunks=stored_chunks,
    )
