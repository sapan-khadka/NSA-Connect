from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk


def test_constitutional_chunk_table_name():
    assert ConstitutionalChunk.__tablename__ == "constitutional_chunks"


def test_constitutional_chunk_columns():
    columns = ConstitutionalChunk.__table__.columns

    assert "id" in columns
    assert "section" in columns
    assert "chunk_index" in columns
    assert "content" in columns
    assert "embedding" in columns
    assert columns["embedding"].type.dim == EMBEDDING_DIMENSION
