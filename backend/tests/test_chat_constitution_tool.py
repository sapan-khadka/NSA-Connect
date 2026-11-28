"""Behavioral tests for on-demand constitution retrieval."""

import json
from unittest.mock import MagicMock

import pytest

from app.services import ai_chat_tools as tools
from app.services.constitution_search_service import ConstitutionSearchHit


@pytest.fixture
def context(monkeypatch):
    db = MagicMock()
    member = MagicMock()

    resolve = MagicMock(return_value=42)
    indexed = MagicMock(return_value=True)
    search = MagicMock(return_value=[
        ConstitutionSearchHit(
            id=7,
            chunk_index=0,
            section="Article III",
            content="Fixture: dues are $20 per semester.",
            similarity_score=0.38,
        )
    ])

    monkeypatch.setattr(tools, "resolve_organization_id", resolve)
    monkeypatch.setattr(tools, "constitution_index_has_chunks", indexed)
    monkeypatch.setattr(tools, "search_constitution_chunks", search)

    def execute(payload):
        return json.loads(tools.execute_chat_tool(
            db=db,
            member=member,
            tool_name="search_constitution",
            tool_input=payload,
        ))

    return execute, db, member, resolve, indexed, search


def test_constitution_tool_registered():
    definitions = [
        item for item in tools.CHAT_TOOL_DEFINITIONS
        if item["name"] == "search_constitution"
    ]
    assert len(definitions) == 1
    schema = definitions[0]["input_schema"]
    assert schema["required"] == ["query"]
    assert schema["additionalProperties"] is False
    assert "organization_id" not in schema["properties"]


def test_focused_query_uses_authenticated_scope(context):
    execute, db, member, resolve, indexed, search = context

    result = execute({"query": "  membership dues requirements  "})

    assert result["status"] == "retrieved"
    assert result["passages"][0]["chunk_id"] == 7
    assert result["passages"][0]["section"] == "Article III"
    assert "$20" in result["passages"][0]["content"]

    resolve.assert_called_once_with(db, member)
    indexed.assert_called_once_with(db, organization_id=42)
    search.assert_called_once_with(
        db,
        query="membership dues requirements",
        limit=5,
        organization_id=42,
    )


@pytest.mark.parametrize("payload", [
    {},
    {"query": ""},
    {"query": "   "},
    {"query": 123},
    {"query": "x" * 1001},
    {"query": "dues", "organization_id": 99},
])
def test_invalid_input_never_reaches_retrieval(context, payload):
    execute, _, _, resolve, indexed, search = context

    result = execute(payload)

    assert result["error"] == "validation_error"
    resolve.assert_not_called()
    indexed.assert_not_called()
    search.assert_not_called()


def test_empty_index_skips_search(context):
    execute, _, _, _, indexed, search = context
    indexed.return_value = False

    result = execute({"query": "elections"})

    assert result["status"] == "empty"
    assert result["passages"] == []
    search.assert_not_called()


def test_no_matching_passages(context):
    execute, _, _, _, _, search = context
    search.return_value = []

    result = execute({"query": "elections"})

    assert result["status"] == "no_results"
    assert result["passages"] == []


def test_retrieval_failure_is_safe(context):
    execute, _, _, _, _, search = context
    search.side_effect = RuntimeError("PRIVATE_INTERNAL_ERROR")

    result = execute({"query": "elections"})

    assert result["error"] == "retrieval_failed"
    assert "PRIVATE_INTERNAL_ERROR" not in json.dumps(result)


def test_index_failure_is_not_reported_as_missing_document(context):
    execute, _, _, _, indexed, search = context
    indexed.side_effect = RuntimeError("database unavailable")

    result = execute({"query": "elections"})

    assert result["error"] == "retrieval_failed"
    search.assert_not_called()


def test_constitution_database_isolation(db_session):
    from app.core.embedding import EMBEDDING_DIMENSION
    from app.models.constitutional_chunk import ConstitutionalChunk
    from app.models.organization import Organization
    from app.services.constitution_search_service import (
        constitution_index_has_chunks,
        search_constitution_chunks,
    )
    from app.services.organization_context import get_default_organization_id

    org_a_id = get_default_organization_id(db_session)
    org_a = db_session.get(Organization, org_a_id)

    org_b = Organization(
        university_id=org_a.university_id,
        name="Isolation Test Club",
        slug="isolation-test-club",
    )
    db_session.add(org_b)
    db_session.flush()

    assert not constitution_index_has_chunks(
        db_session, organization_id=org_b.id
    )

    vector = [1.0] + [0.0] * (EMBEDDING_DIMENSION - 1)

    chunk_a = ConstitutionalChunk(
        organization_id=org_a.id,
        section="Article III",
        chunk_index=0,
        content="Club A private constitution fixture",
        embedding=vector,
    )

    chunk_b = ConstitutionalChunk(
        organization_id=org_b.id,
        section="Article III",
        chunk_index=0,
        content="Club B private constitution fixture",
        embedding=vector,
    )

    db_session.add_all([chunk_a, chunk_b])
    db_session.flush()

    for organization, expected, forbidden in (
        (org_a, chunk_a, chunk_b),
        (org_b, chunk_b, chunk_a),
    ):
        assert constitution_index_has_chunks(
            db_session, organization_id=organization.id
        )

        hits = search_constitution_chunks(
            db_session,
            query="membership requirements",
            limit=5,
            query_embedding=vector,
            organization_id=organization.id,
        )

        ids = {hit.id for hit in hits}
        assert expected.id in ids
        assert forbidden.id not in ids
