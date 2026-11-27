import math
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.constitutional_chunk import ConstitutionalChunk
from app.services.embedding_service import generate_embeddings
from app.services.organization_context import get_default_organization_id


@dataclass(frozen=True)
class ConstitutionSearchHit:
    id: int
    chunk_index: int
    section: str | None
    content: str
    similarity_score: float


def clamp_cosine_similarity(value: float) -> float:
    """Keep chat scores on the same 0–1 cosine scale as normalized embeddings."""
    return max(0.0, min(1.0, float(value)))


def cosine_similarity_from_distance(distance: float) -> float:
    """Convert pgvector cosine distance to cosine similarity.

    For normalized vectors, pgvector's cosine distance is ``1 - cosine``.
    """
    return clamp_cosine_similarity(1.0 - float(distance))


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
    organization_id: int,
) -> list[ConstitutionSearchHit]:
    distance = ConstitutionalChunk.embedding.cosine_distance(query_embedding).label(
        "distance",
    )
    rows = db.execute(
        select(ConstitutionalChunk, distance)
        .where(
            ConstitutionalChunk.organization_id == organization_id
        )
        .order_by(distance)
        .limit(limit),
    ).all()

    return [
        ConstitutionSearchHit(
            id=chunk.id,
            chunk_index=chunk.chunk_index,
            section=chunk.section,
            content=chunk.content,
            similarity_score=cosine_similarity_from_distance(distance_value),
        )
        for chunk, distance_value in rows
    ]


def _search_in_memory(
    db: Session,
    query_embedding: list[float],
    limit: int,
    organization_id: int,
) -> list[ConstitutionSearchHit]:
    chunks = db.scalars(
        select(ConstitutionalChunk).where(
            ConstitutionalChunk.organization_id == organization_id
        )
    ).all()
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
            similarity_score=clamp_cosine_similarity(
                _cosine_similarity(query_embedding, list(chunk.embedding)),
            ),
        )
        for chunk in ranked
    ]


def constitution_index_has_chunks(
    db: Session, *, organization_id: int | None = None
) -> bool:
    """True when the selected organization has constitution chunks."""
    org_id = (
        organization_id if organization_id is not None
        else get_default_organization_id(db)
    )
    return (
        db.scalar(
            select(ConstitutionalChunk.id)
            .where(ConstitutionalChunk.organization_id == org_id)
            .limit(1)
        )
        is not None
    )


def search_constitution_chunks(
    db: Session,
    *,
    query: str,
    limit: int | None = None,
    query_embedding: list[float] | None = None,
    organization_id: int | None = None,
) -> list[ConstitutionSearchHit]:
    """Find constitution chunks most similar to a natural-language question."""
    org_id = (
        organization_id if organization_id is not None
        else get_default_organization_id(db)
    )
    result_limit = limit or settings.CONSTITUTION_SEARCH_DEFAULT_LIMIT
    if query_embedding is None:
        query_embedding = generate_embeddings([query.strip()])[0]

    if db.get_bind().dialect.name == "postgresql":
        return _search_with_pgvector(db, query_embedding, result_limit, org_id)

    return _search_in_memory(db, query_embedding, result_limit, org_id)
