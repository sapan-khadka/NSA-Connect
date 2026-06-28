from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk
from app.services.constitution_search_service import search_constitution_chunks


def _unit_vector(first_index: int) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSION
    vector[first_index] = 1.0
    return vector


def _seed_chunks(db_session):
    db_session.add_all(
        [
            ConstitutionalChunk(
                section="Article I",
                chunk_index=0,
                content="The organization shall be named NSA.",
                embedding=_unit_vector(0),
            ),
            ConstitutionalChunk(
                section="Article II",
                chunk_index=1,
                content="Members must maintain good academic standing.",
                embedding=_unit_vector(1),
            ),
        ]
    )
    db_session.commit()


def test_search_ranks_most_similar_chunk_first(db_session, monkeypatch):
    _seed_chunks(db_session)

    def fake_embeddings(texts: list[str]) -> list[list[float]]:
        assert texts == ["What is the organization name?"]
        return [_unit_vector(0)]

    monkeypatch.setattr(
        "app.services.constitution_search_service.generate_embeddings",
        fake_embeddings,
    )

    hits = search_constitution_chunks(
        db_session,
        query="What is the organization name?",
        limit=2,
    )

    assert len(hits) == 2
    assert hits[0].content == "The organization shall be named NSA."
    assert hits[0].similarity_score == 1.0
    assert hits[1].similarity_score == 0.0


def test_search_returns_empty_list_when_no_chunks(db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.constitution_search_service.generate_embeddings",
        lambda texts: [_unit_vector(0)],
    )

    hits = search_constitution_chunks(db_session, query="Any question?")

    assert hits == []
