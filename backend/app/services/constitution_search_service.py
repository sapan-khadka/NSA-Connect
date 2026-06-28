import math
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.constitutional_chunk import ConstitutionalChunk
from app.services.embedding_service import generate_embeddings


@dataclass(frozen=True)
class ConstitutionSearchHit:
    id: int
    chunk_index: int
    section: str | None
    content: str
    similarity_score: float


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot_product / (left_norm * right_norm)


def _search_with_pgvector(
    db: Session,
    query_embedding: list[float],
    limit: int,
) -> list[ConstitutionSearchHit]:
    distance = ConstitutionalChunk.embedding.cosine_distance(query_embedding).label(
        "distance",
    )
    rows = db.execute(
        select(ConstitutionalChunk, distance)
        .order_by(distance)
        .limit(limit),
    ).all()

    return [
        ConstitutionSearchHit(
            id=chunk.id,
            chunk_index=chunk.chunk_index,
            section=chunk.section,
            content=chunk.content,
            similarity_score=max(0.0, 1.0 - float(distance_value)),
        )
        for chunk, distance_value in rows
    ]


def _search_in_memory(
    db: Session,
    query_embedding: list[float],
    limit: int,
) -> list[ConstitutionSearchHit]:
    chunks = db.scalars(select(ConstitutionalChunk)).all()
    ranked = sorted(
        chunks,
        key=lambda chunk: _cosine_similarity(query_embedding, list(chunk.embedding)),
        reverse=True,
    )[:limit]

    return [
        ConstitutionSearchHit(
            id=chunk.id,
            chunk_index=chunk.chunk_index,
            section=chunk.section,
            content=chunk.content,
            similarity_score=_cosine_similarity(query_embedding, list(chunk.embedding)),
        )
        for chunk in ranked
    ]


def search_constitution_chunks(
    db: Session,
    *,
    query: str,
    limit: int | None = None,
) -> list[ConstitutionSearchHit]:
    """Find constitution chunks most similar to a natural-language question."""
    result_limit = limit or settings.CONSTITUTION_SEARCH_DEFAULT_LIMIT
    query_embedding = generate_embeddings([query.strip()])[0]

    if db.get_bind().dialect.name == "postgresql":
        return _search_with_pgvector(db, query_embedding, result_limit)

    return _search_in_memory(db, query_embedding, result_limit)
