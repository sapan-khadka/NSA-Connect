"""End-to-end integration tests for the constitution RAG pipeline."""

from unittest.mock import MagicMock, patch

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk
from tests.helpers.anthropic_mocks import (
    CHAT_CLIENT_PATCH,
    CHAT_SETTINGS_PATCH,
    build_mock_anthropic_text_response,
)
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF

CONSTITUTION_PHRASE = "NSA Constitution Article I"
CONSTITUTION_QUESTION = "What does Article I of the NSA constitution say?"


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


def _constitution_upload_files():
    return {
        "file": (
            "nsa-constitution.pdf",
            SAMPLE_CONSTITUTION_PDF,
            "application/pdf",
        ),
    }


def _chat_settings_mock() -> MagicMock:
    settings = MagicMock()
    settings.AI_ENABLED = True
    settings.ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
    settings.ANTHROPIC_API_KEY = "sk-ant-test-key"
    settings.AI_CHAT_RAG_CHUNK_LIMIT = 5
    return settings


def test_full_rag_pipeline_upload_embed_search_and_chat_cites_constitution(
    client,
    board_member_headers,
    general_member_headers,
    db_session,
):
    upload_response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files=_constitution_upload_files(),
    )
    assert upload_response.status_code == 201

    upload_body = upload_response.json()
    uploaded_chunk = upload_body["chunks"][0]["content"]
    assert CONSTITUTION_PHRASE in uploaded_chunk

    stored_rows = (
        db_session.query(ConstitutionalChunk)
        .order_by(
            ConstitutionalChunk.chunk_index,
        )
        .all()
    )
    assert len(stored_rows) == upload_body["chunk_count"]
    assert all(len(row.embedding) == EMBEDDING_DIMENSION for row in stored_rows)
    assert CONSTITUTION_PHRASE in stored_rows[0].content

    search_response = client.post(
        "/api/v1/constitution/search",
        headers=general_member_headers,
        json={"query": CONSTITUTION_QUESTION},
    )
    assert search_response.status_code == 200
    search_body = search_response.json()
    assert search_body["result_count"] >= 1
    assert CONSTITUTION_PHRASE in search_body["results"][0]["content"]

    captured: dict[str, str] = {}

    def fake_chat_create(**kwargs):
        captured["system"] = kwargs["system"]
        assert CONSTITUTION_PHRASE in kwargs["system"]
        return build_mock_anthropic_text_response(
            "According to the NSA constitution (Article I), the document states: "
            f"{CONSTITUTION_PHRASE}."
        )

    mock_chat_client = MagicMock(name="anthropic_chat_client")
    mock_chat_client.messages.create.side_effect = fake_chat_create

    with (
        patch(CHAT_SETTINGS_PATCH, return_value=_chat_settings_mock()),
        patch(CHAT_CLIENT_PATCH, return_value=mock_chat_client),
    ):
        chat_response = client.post(
            "/api/v1/ai/chat",
            headers=general_member_headers,
            json={"message": CONSTITUTION_QUESTION},
        )

    assert chat_response.status_code == 200
    chat_body = chat_response.json()

    assert chat_body["constitution_sources"]
    assert CONSTITUTION_PHRASE in chat_body["constitution_sources"][0]["excerpt"]
    assert chat_body["constitution_sources"][0]["similarity_score"] >= 0.0

    reply = chat_body["reply"].lower()
    assert "constitution" in reply
    assert "article i" in reply
    assert CONSTITUTION_PHRASE.lower() in reply

    assert CONSTITUTION_PHRASE in captured["system"]
    mock_chat_client.messages.create.assert_called_once()
