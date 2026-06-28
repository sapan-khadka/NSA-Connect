from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk
from app.services.constitution_chunk_service import ConstitutionTextChunk
from app.services.constitution_ingest_service import (
    ingest_constitution_pdf,
    store_constitution_chunks,
)
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF


def test_store_constitution_chunks_persists_embeddings(db_session):
    text_chunks = [
        ConstitutionTextChunk(
            chunk_index=0,
            content="Article I. Name of the organization.",
            token_count=8,
            section="Article I. Name",
        )
    ]

    stored = store_constitution_chunks(db_session, text_chunks)

    assert len(stored) == 1
    assert stored[0].id is not None
    row = db_session.get(ConstitutionalChunk, stored[0].id)
    assert row is not None
    assert len(row.embedding) == EMBEDDING_DIMENSION
    assert row.content == text_chunks[0].content


def test_store_constitution_chunks_replaces_existing_rows(db_session):
    db_session.add(
        ConstitutionalChunk(
            section="Old",
            chunk_index=0,
            content="old content",
            embedding=[0.0] * EMBEDDING_DIMENSION,
        )
    )
    db_session.commit()

    text_chunks = [
        ConstitutionTextChunk(
            chunk_index=0,
            content="new content",
            token_count=2,
        )
    ]
    store_constitution_chunks(db_session, text_chunks)

    rows = db_session.query(ConstitutionalChunk).all()
    assert len(rows) == 1
    assert rows[0].content == "new content"


def test_ingest_constitution_pdf_chunks_and_stores(db_session):
    result = ingest_constitution_pdf(
        db_session,
        file_bytes=SAMPLE_CONSTITUTION_PDF,
        content_type="application/pdf",
        filename="constitution.pdf",
    )

    assert result.filename == "constitution.pdf"
    assert len(result.chunks) >= 1

    rows = db_session.query(ConstitutionalChunk).all()
    assert len(rows) == len(result.chunks)
    assert all(len(row.embedding) == EMBEDDING_DIMENSION for row in rows)
