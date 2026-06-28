import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def _seed_chunks(db_session):
    db_session.add(
        ConstitutionalChunk(
            section="Article I",
            chunk_index=0,
            content="NSA Constitution Article I governs membership requirements.",
            embedding=[1.0] + [0.0] * (EMBEDDING_DIMENSION - 1),
        )
    )
    db_session.commit()


def test_approved_member_can_search_constitution(
    client,
    general_member_headers,
    db_session,
    monkeypatch,
):
    _seed_chunks(db_session)

    def fake_embeddings(texts: list[str]) -> list[list[float]]:
        return [[1.0] + [0.0] * (EMBEDDING_DIMENSION - 1)]

    monkeypatch.setattr(
        "app.services.constitution_search_service.generate_embeddings",
        fake_embeddings,
    )

    response = client.post(
        "/api/v1/constitution/search",
        headers=general_member_headers,
        json={"query": "What are the membership requirements?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "What are the membership requirements?"
    assert body["result_count"] == 1
    assert body["results"][0]["content"].startswith("NSA Constitution Article I")
    assert body["results"][0]["similarity_score"] == 1.0


def test_search_requires_authentication(client, db_session):
    _seed_chunks(db_session)

    response = client.post(
        "/api/v1/constitution/search",
        json={"query": "Who can join?"},
    )

    assert response.status_code == 401


def test_search_returns_empty_results_when_index_is_empty(
    client,
    general_member_headers,
    monkeypatch,
):
    monkeypatch.setattr(
        "app.services.constitution_search_service.generate_embeddings",
        lambda texts: [[1.0] + [0.0] * (EMBEDDING_DIMENSION - 1)],
    )

    response = client.post(
        "/api/v1/constitution/search",
        headers=general_member_headers,
        json={"query": "Who can join?"},
    )

    assert response.status_code == 200
    assert response.json()["result_count"] == 0
    assert response.json()["results"] == []


def test_search_after_upload_finds_relevant_chunk(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
    monkeypatch,
):
    upload_response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files={
            "file": (
                "nsa-constitution.pdf",
                SAMPLE_CONSTITUTION_PDF,
                "application/pdf",
            ),
        },
    )
    assert upload_response.status_code == 201

    chunk_id = upload_response.json()["chunks"][0]["id"]
    stored = db_session.get(ConstitutionalChunk, chunk_id)
    stored_embedding = list(stored.embedding)

    monkeypatch.setattr(
        "app.services.constitution_search_service.generate_embeddings",
        lambda texts: [stored_embedding],
    )

    search_response = client.post(
        "/api/v1/constitution/search",
        headers=general_member_headers,
        json={"query": "What does Article I say?", "limit": 3},
    )

    assert search_response.status_code == 200
    results = search_response.json()["results"]
    assert len(results) >= 1
    assert results[0]["content"] == stored.content
    assert results[0]["similarity_score"] == 1.0


def test_search_returns_503_when_openai_not_configured(
    client,
    general_member_headers,
    monkeypatch,
):
    monkeypatch.setattr("app.core.config.settings.OPENAI_API_KEY", "")

    response = client.post(
        "/api/v1/constitution/search",
        headers=general_member_headers,
        json={"query": "What are officer duties?"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Embedding generation is not configured"
