"""Relevance, privacy, and permission checks for the AI assistant."""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    create_board_member,
    create_president_member,
    create_treasurer_member,
    create_vice_president_member,
)

from app.models.event import Event, EventType, MeetingVisibility
from app.models.meeting import MeetingRecord
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.ai import ChatHistoryMessage, ChatRequest
from app.services.ai_chat_service import (
    _prepare_chat_context,
    _relevant_hits,
    chat_with_nsa_assistant,
)
from app.services.ai_chat_tools import execute_chat_tool
from app.services.constitution_search_service import (
    ConstitutionSearchHit,
    cosine_similarity_from_distance,
)
from app.services.org_document_service import OrgDocumentSearchHit
from app.services.organization_context import (
    ensure_membership_for_member,
    get_default_organization_id,
)
from tests.helpers.anthropic_mocks import mock_claude_chat_api


class _Settings:
    AI_CHAT_RAG_CHUNK_LIMIT = 5
    AI_CHAT_RAG_MIN_SIMILARITY = 0.45


def _member(db_session, *, email: str, role: MemberRole, student_id: str) -> Member:
    member = Member(
        full_name="Assistant Member",
        email=email,
        student_id=student_id,
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=role,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _attach_owner(db_session, member: Member) -> Member:
    membership = ensure_membership_for_member(db_session, member)
    membership.is_org_owner = True
    db_session.commit()
    db_session.refresh(membership)
    member._active_membership = membership
    return member


def _finance(db_session, member: Member) -> str:
    return execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_finance_summary",
        tool_input={},
    )


def _minutes(db_session, member: Member) -> str:
    return execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_published_meeting_minutes",
        tool_input={"keyword": "Voting"},
    )


def _publish_minutes(db_session, member: Member) -> None:
    event = Event(
        title="Voting Meeting",
        description="Agenda",
        event_type=EventType.MEETING,
        starts_at=datetime(2026, 10, 1, tzinfo=UTC),
        budget=Decimal("0.00"),
        meeting_visibility=MeetingVisibility.BOARD_ONLY,
        created_by_id=member.id,
        organization_id=get_default_organization_id(db_session),
    )
    db_session.add(event)
    db_session.flush()
    db_session.add(
        MeetingRecord(
            event_id=event.id,
            raw_notes="SECRET RAW NOTES",
            summary="Official voting overview.",
            key_decisions=[],
            action_items=[],
            published_at=datetime(2026, 10, 2, tzinfo=UTC),
        )
    )
    db_session.commit()


def _public_event(db_session, member: Member) -> Event:
    event = Event(
        title="Public Cultural Night",
        description="Open to members",
        event_type=EventType.CULTURAL,
        starts_at=datetime(2030, 6, 1, 23, tzinfo=UTC),
        location="University Center",
        budget=Decimal("1250.00"),
        created_by_id=member.id,
        organization_id=get_default_organization_id(db_session),
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def _patch_retrieval(monkeypatch, constitution_hits, document_hits=None, has_documents=False):
    embeds: list[list[str]] = []
    constitution_embeddings: list[list[float]] = []
    document_embeddings: list[list[float]] = []

    def embed(texts):
        embeds.append(list(texts))
        return [[0.1, 0.2, 0.3]]

    def constitution(_db, *, query, limit, query_embedding):
        constitution_embeddings.append(query_embedding)
        return constitution_hits

    def documents(_db, *, member, query, limit, query_embedding):
        document_embeddings.append(query_embedding)
        return document_hits or []

    monkeypatch.setattr("app.services.ai_chat_service.get_settings", lambda: _Settings())
    monkeypatch.setattr(
        "app.services.ai_chat_tools.constitution_index_has_chunks",
        lambda _db: True,
    )
    monkeypatch.setattr("app.services.ai_chat_service.generate_embeddings", embed)
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        constitution,
    )
    if has_documents:
        monkeypatch.setattr(
            "app.services.ai_chat_service.organization_has_document_chunks",
            lambda _db: True,
        )
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_org_document_chunks",
        documents,
    )
    return embeds, constitution_embeddings, document_embeddings


def _prepare(db_session, member, message, monkeypatch, hits, **kwargs):
    recorded = _patch_retrieval(monkeypatch, hits, **kwargs)
    _context, sources, _messages = _prepare_chat_context(
        db_session,
        member=member,
        data=ChatRequest(message=message),
    )
    return _context, sources, recorded



def _search_for_test(
    db_session, member, monkeypatch, hits,
    *, query="Official constitution rules", indexed=True,
    fail=False,
):
    calls = []

    def search(_db, **kwargs):
        calls.append(kwargs)
        if fail:
            raise RuntimeError("search unavailable")
        return hits

    monkeypatch.setattr(
        "app.services.ai_chat_tools.constitution_index_has_chunks",
        lambda *args, **kwargs: indexed,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        search,
    )

    payload = json.loads(execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="search_constitution",
        tool_input={"query": query},
    ))

    return payload, calls


def test_cosine_distance_uses_similarity_not_distance():
    assert cosine_similarity_from_distance(0) == 1
    assert cosine_similarity_from_distance(1) == 0
    assert cosine_similarity_from_distance(1.4) == 0


def test_chat_keeps_voting_passage_below_similarity_floor(db_session, monkeypatch):
    member = _member(
        db_session,
        email="voting-floor@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000017",
    )
    seen: dict[str, int] = {}

    def constitution(_db, *, query, limit, query_embedding):
        seen["limit"] = limit
        return [
            ConstitutionSearchHit(
                1,
                6,
                "Elections",
                "In order to vote, you must be physically present.",
                0.335,
            )
        ]

    monkeypatch.setattr("app.services.ai_chat_service.get_settings", lambda: _Settings())
    monkeypatch.setattr(
        "app.services.ai_chat_tools.constitution_index_has_chunks",
        lambda _db: True,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.generate_embeddings",
        lambda _texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        constitution,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.organization_has_document_chunks",
        lambda _db: True,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_org_document_chunks",
        lambda *_args, **_kwargs: [
            OrgDocumentSearchHit(
                9,
                1,
                "Handbook",
                "public",
                0,
                "Dues",
                "Members pay semester dues.",
                0.222,
            )
        ],
    )
    context, sources, _messages = _prepare_chat_context(
        db_session,
        member=member,
        data=ChatRequest(message="What does the constitution say about voting?"),
    )
    assert seen == {}
    assert sources == []
    payload, calls = _search_for_test(
        db_session, member, monkeypatch,
        [ConstitutionSearchHit(
            1, 6, "Elections",
            "In order to vote, you must be physically present.",
            0.335,
        )],
        query="Voting eligibility and physical presence",
    )
    assert calls[0]["limit"] == 5
    assert payload["status"] == "retrieved"
    assert payload["passages"][0]["chunk_id"] == 1
    assert payload["passages"][0]["similarity_score"] == 0.335
    assert "physically present" in payload["passages"][0]["content"]
    assert "Members pay semester dues." not in context


def test_similarity_floor_keeps_boundary_and_drops_weaker_hits():
    hits = [
        ConstitutionSearchHit(1, 0, "Voting", "Officers are elected.", 0.45),
        ConstitutionSearchHit(2, 1, "Dues", "Nearly orthogonal.", 0.449),
        ConstitutionSearchHit(3, 2, "Blank", "   ", 0.91),
    ]
    kept = _relevant_hits(hits, 0.45)
    assert [hit.id for hit in kept] == [1]


def test_general_member_keeps_relevant_constitution_excerpt(db_session, monkeypatch):
    member = _member(
        db_session,
        email="general-rag@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000001",
    )
    context, sources, _recorded = _prepare(
        db_session,
        member,
        "What does the constitution say about voting?",
        monkeypatch,
        [ConstitutionSearchHit(1, 0, "Voting", "Officers must be elected.", 0.82)],
    )
    assert sources == []
    assert "Officers must be elected." not in context
    payload, calls = _search_for_test(
        db_session, member, monkeypatch,
        [ConstitutionSearchHit(
            1, 0, "Voting", "Officers must be elected.", 0.82,
        )],
        query="Officer elections",
    )
    assert payload["status"] == "retrieved"
    assert payload["passages"][0]["content"] == "Officers must be elected."
    assert payload["passages"][0]["section"] == "Voting"
    assert calls[0]["query"] == "Officer elections"


def test_mixed_question_keeps_relevant_excerpt_and_live_tools(db_session, monkeypatch):
    member = _member(
        db_session,
        email="mixed-rag@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000002",
    )
    context, sources, _recorded = _prepare(
        db_session,
        member,
        "What is the treasury balance, and what does the constitution say about dues?",
        monkeypatch,
        [
            ConstitutionSearchHit(1, 0, "Dues", "Members pay semester dues.", 0.82),
            ConstitutionSearchHit(2, 1, "Events", "Unrelated nearest neighbor.", 0.21),
        ],
        document_hits=[
            OrgDocumentSearchHit(
                9,
                1,
                "Handbook",
                "public",
                0,
                "Other",
                "Unrelated document neighbor.",
                0.21,
            )
        ],
        has_documents=True,
    )
    assert sources == []
    assert "Members pay semester dues." not in context
    assert "Unrelated nearest neighbor." not in context
    assert "Unrelated document neighbor." not in context
    assert "live" in context.lower()
    payload, calls = _search_for_test(
        db_session, member, monkeypatch,
        [
            ConstitutionSearchHit(
                1, 0, "Dues", "Members pay semester dues.", 0.82,
            ),
            ConstitutionSearchHit(
                2, 1, "Events", "Unrelated nearest neighbor.", 0.21,
            ),
        ],
        query="Constitutional semester dues requirements",
    )
    assert calls[0]["query"] == "Constitutional semester dues requirements"
    assert [p["chunk_id"] for p in payload["passages"]] == [1, 2]


def test_irrelevant_document_excerpt_is_omitted(db_session, monkeypatch):
    member = _member(
        db_session,
        email="docs-rag@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000003",
    )
    context, _sources, recorded = _prepare(
        db_session,
        member,
        "When is the next event?",
        monkeypatch,
        [],
        document_hits=[
            OrgDocumentSearchHit(
                1, 1, "Bylaws", "public", 0, "Fees", "Relevant fee rule.", 0.70
            ),
            OrgDocumentSearchHit(
                2, 1, "Bylaws", "public", 1, "Other", "Irrelevant document text.", 0.20
            ),
        ],
        has_documents=True,
    )
    assert "Relevant fee rule." in context
    assert "Irrelevant document text." not in context
    assert len(recorded[0]) == 1
    assert recorded[1] == []
    assert recorded[2] == [[0.1, 0.2, 0.3]]


def test_empty_document_library_skips_initial_embedding(db_session, monkeypatch):
    member = _member(
        db_session,
        email="empty-docs@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000004",
    )
    _context, _sources, recorded = _prepare(
        db_session,
        member,
        "What events are coming up?",
        monkeypatch,
        [],
    )
    embeds, constitution_embeddings, document_embeddings = recorded
    assert embeds == []
    assert constitution_embeddings == []
    assert document_embeddings == []


def test_stale_assistant_history_is_not_sent_to_the_model(db_session, monkeypatch):
    member = create_board_member(db_session, email="history-board@semo.edu", student_id="61000005")
    monkeypatch.setattr(
        "app.services.ai_chat_service.generate_embeddings",
        lambda _texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        lambda *_args, **_kwargs: [],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.organization_has_document_chunks",
        lambda _db: False,
    )
    request = ChatRequest(
        message="What is the balance now?",
        history=[
            ChatHistoryMessage(
                role="assistant",
                content="The treasury balance is 4242.00.",
            ),
            ChatHistoryMessage(role="user", content="Which events are next?"),
        ],
    )
    with mock_claude_chat_api() as client:
        chat_with_nsa_assistant(db_session, member=member, data=request)
    sent = json.dumps(client.messages.create.call_args.kwargs["messages"])
    assert "4242.00" not in sent
    assert "Which events are next?" in sent
    assert "What is the balance now?" in sent


def test_general_member_cannot_read_treasury_or_minutes(db_session):
    member = _member(
        db_session,
        email="general-private@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000006",
    )
    _publish_minutes(db_session, member)
    treasury = _finance(db_session, member)
    minutes = _minutes(db_session, member)
    assert "permission_denied" in treasury
    assert "balance" not in treasury
    assert "permission_denied" in minutes
    assert "Official voting overview." not in minutes
    assert "SECRET RAW NOTES" not in minutes


@pytest.mark.parametrize(
    ("factory", "email", "student_id"),
    [
        (create_president_member, "president-tool@semo.edu", "61000007"),
        (create_vice_president_member, "vp-tool@semo.edu", "61000008"),
        (create_treasurer_member, "treasurer-tool@semo.edu", "61000009"),
    ],
)
def test_finance_officers_can_read_treasury(db_session, factory, email, student_id):
    member = factory(db_session, email=email, student_id=student_id)
    result = _finance(db_session, member)
    assert "permission_denied" not in result
    assert "balance" in result


def test_plain_board_cannot_read_treasury_and_owner_can(db_session):
    board = create_board_member(
        db_session,
        email="plain-board-tool@semo.edu",
        student_id="61000010",
    )
    owner = _attach_owner(
        db_session,
        _member(
            db_session,
            email="owner-tool@semo.edu",
            role=MemberRole.GENERAL,
            student_id="61000011",
        ),
    )
    board_result = _finance(db_session, board)
    owner_result = _finance(db_session, owner)
    assert "permission_denied" in board_result
    assert "balance" not in board_result
    assert "permission_denied" not in owner_result
    assert "balance" in owner_result


def test_board_and_owner_can_read_published_minutes(db_session):
    board = create_board_member(
        db_session,
        email="minutes-board@semo.edu",
        student_id="61000012",
    )
    owner = _attach_owner(
        db_session,
        _member(
            db_session,
            email="minutes-owner@semo.edu",
            role=MemberRole.GENERAL,
            student_id="61000013",
        ),
    )
    _publish_minutes(db_session, board)
    for member in (board, owner):
        result = _minutes(db_session, member)
        assert "Official voting overview." in result
        assert "SECRET RAW NOTES" not in result
        assert "permission_denied" not in result


def test_general_member_event_tools_omit_budget(db_session):
    creator = create_board_member(
        db_session,
        email="event-creator@semo.edu",
        student_id="61000014",
    )
    event = _public_event(db_session, creator)
    general = _member(
        db_session,
        email="event-general@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000015",
    )
    listed = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="list_upcoming_events",
        tool_input={"limit": 10},
    )
    details = execute_chat_tool(
        db=db_session,
        member=general,
        tool_name="get_event_details",
        tool_input={"event_id": event.id},
    )
    listed_payload = json.loads(listed)
    detail_payload = json.loads(details)

    listed_event = next(
        item for item in listed_payload if item["id"] == event.id
    )

    for payload in (listed_event, detail_payload):
        assert payload["title"] == "Public Cultural Night"
        assert payload["location"] == "University Center"
        assert "budget" not in payload
        assert payload["budget_access"] == "restricted"
        assert "1250" not in json.dumps(payload)
    board_details = execute_chat_tool(
        db=db_session,
        member=creator,
        tool_name="get_event_details",
        tool_input={"event_id": event.id},
    )
    board_payload = json.loads(board_details)
    assert board_payload["budget"] == "1250.00"
    assert board_payload["budget_access"] == "authorized"


def test_user_supplied_treasury_figure_is_not_live_data(db_session, monkeypatch):
    member = _member(
        db_session,
        email="pasted-balance@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000016",
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.generate_embeddings",
        lambda _texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        lambda *_args, **_kwargs: [],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.organization_has_document_chunks",
        lambda _db: False,
    )
    request = ChatRequest(
        message="Is that our balance?",
        history=[
            ChatHistoryMessage(
                role="user",
                content="The treasury balance is 5151.00.",
            ),
        ],
    )
    with mock_claude_chat_api() as client:
        chat_with_nsa_assistant(db_session, member=member, data=request)
    system_prompt = client.messages.create.call_args.kwargs["system"]
    sent = json.dumps(client.messages.create.call_args.kwargs["messages"])
    treasury = _finance(db_session, member)
    assert "say the figure is unverified" in system_prompt
    assert "Do not present it as the chapter balance" in system_prompt
    assert "5151.00" in sent
    assert "Do not answer it." in sent
    assert "Answer only this latest user message." in sent
    assert "permission_denied" in treasury
    assert "5151.00" not in treasury
    assert "balance" not in treasury


# These tests inspect prompts and message payloads. They do not call the
# production model and do not show that the model will follow the instructions.
RECALL_QUESTIONS = [
    "What is the election process?",
    "What does the constitution say about the election process?",
    "What does the constitution say about voting?",
    "Who counts the ballots?",
    "What events are coming up?",
    "What is our treasury balance?",
    "How are amendments adopted?",
    "Who is eligible for membership?",
    "What are the duties of the officers?",
    "What is the treasury balance, and what does the constitution say about dues?",
]


@pytest.mark.parametrize(("offset", "question"), list(enumerate(RECALL_QUESTIONS)))
def test_initial_context_does_not_eagerly_retrieve_constitution(
    db_session,
    monkeypatch,
    offset,
    question,
):
    member = _member(
        db_session,
        email=f"recall-{offset}@semo.edu",
        role=MemberRole.GENERAL,
        student_id=f"610002{offset:02d}",
    )
    context, sources, _recorded = _prepare(
        db_session,
        member,
        question,
        monkeypatch,
        [
            ConstitutionSearchHit(
                1,
                6,
                "Elections",
                "Elections shall be held each academic year.",
                0.12,
            )
        ],
    )
    assert sources == []
    assert "Elections shall be held each academic year." not in context
    assert "search_constitution" in context
    assert "No search has been performed yet." in context
    assert _recorded[1] == []
    assert "Do not recite neighboring provisions from the same excerpt." in context
    assert "Answer only the latest user question." in context


def test_events_turn_keeps_earlier_questions_as_context_only(db_session, monkeypatch):
    member = _member(
        db_session,
        email="events-context@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000300",
    )
    _patch_retrieval(
        monkeypatch,
        [
            ConstitutionSearchHit(
                1,
                4,
                "Events",
                "The event manager coordinates programs.",
                0.20,
            )
        ],
    )
    request = ChatRequest(
        message="What events are coming up?",
        history=[
            ChatHistoryMessage(
                role="assistant",
                content=(
                    "The treasury balance is 4242.00. SECRET RAW NOTES. "
                    "Official voting overview."
                ),
            ),
            ChatHistoryMessage(
                role="user",
                content="The treasury balance is 5151.00.",
            ),
            *[
                ChatHistoryMessage(role="user", content=question)
                for question in RECALL_QUESTIONS[:4]
            ],
        ],
    )
    context, sources, messages = _prepare_chat_context(
        db_session,
        member=member,
        data=request,
    )
    sent = json.dumps(messages)
    assert sources == []
    assert "4242.00" not in sent
    assert "SECRET RAW NOTES" not in sent
    assert "Official voting overview." not in sent
    assert "5151.00" in sent
    assert "say the figure is unverified" in context
    assert sent.count("Do not answer it.") == 5
    assert "Answer only this latest user message." in sent
    assert "Do not answer earlier questions again." in context
    assert "What is the election process?" in sent
    assert messages[-1]["content"].count("What events are coming up?") == 1


def test_later_turn_still_answers_only_the_latest_question(db_session, monkeypatch):
    member = _member(
        db_session,
        email="latest-only@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000301",
    )
    _patch_retrieval(monkeypatch, [])
    request = ChatRequest(
        message=RECALL_QUESTIONS[-1],
        history=[
            ChatHistoryMessage(role="user", content=question)
            for question in RECALL_QUESTIONS[:-1]
        ],
    )
    _context, _sources, messages = _prepare_chat_context(
        db_session,
        member=member,
        data=request,
    )
    sent = json.dumps(messages)
    assert sent.count("Do not answer it.") == len(RECALL_QUESTIONS) - 1
    assert "Answer only this latest user message." in messages[-1]["content"]
    assert RECALL_QUESTIONS[-1] in messages[-1]["content"]


def test_constitution_index_empty_is_stated_directly(db_session, monkeypatch):
    member = _member(
        db_session,
        email="index-empty@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000302",
    )
    _patch_retrieval(monkeypatch, [])
    monkeypatch.setattr(
        "app.services.ai_chat_tools.constitution_index_has_chunks",
        lambda _db: False,
    )
    context, sources, recorded = _prepare_chat_context_recorded(
        db_session,
        member,
        "What is the election process?",
        monkeypatch,
    )
    assert sources == []
    assert "No search has been performed yet." in context
    assert recorded == []
    payload, calls = _search_for_test(
        db_session, member, monkeypatch, [], indexed=False,
    )
    assert payload["status"] == "empty"
    assert payload["passages"] == []
    assert calls == []


def _prepare_chat_context_recorded(db_session, member, message, monkeypatch):
    embeds: list[list[str]] = []

    def embed(texts):
        embeds.append(list(texts))
        return [[0.1, 0.2, 0.3]]

    monkeypatch.setattr("app.services.ai_chat_service.get_settings", lambda: _Settings())
    monkeypatch.setattr("app.services.ai_chat_service.generate_embeddings", embed)
    context, sources, _messages = _prepare_chat_context(
        db_session,
        member=member,
        data=ChatRequest(message=message),
    )
    return context, sources, embeds


def test_indexed_constitution_without_excerpts_is_not_missing(db_session, monkeypatch):
    member = _member(
        db_session,
        email="indexed-empty@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000303",
    )
    _patch_retrieval(monkeypatch, [])
    context, sources, _recorded = _prepare(
        db_session,
        member,
        "What is the election process?",
        monkeypatch,
        [],
    )
    assert sources == []
    assert "Do not infer that the constitution is missing." in context
    payload, calls = _search_for_test(
        db_session, member, monkeypatch, [],
    )
    assert payload["status"] == "no_results"
    assert payload["passages"] == []
    assert len(calls) == 1


def test_empty_document_library_does_not_make_constitution_missing(
    db_session,
    monkeypatch,
):
    member = _member(
        db_session,
        email="docs-empty@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000304",
    )
    context, sources, _recorded = _prepare(
        db_session,
        member,
        "What does the constitution say about voting?",
        monkeypatch,
        [
            ConstitutionSearchHit(
                1,
                6,
                "Voting",
                "In order to vote, you must be physically present.",
                0.33,
            )
        ],
    )
    assert sources == []
    assert "The additional organization document library is empty." in context
    assert "This does not mean the constitution is missing." in context
    payload, calls = _search_for_test(
        db_session, member, monkeypatch,
        [ConstitutionSearchHit(
            1, 6, "Voting",
            "In order to vote, you must be physically present.",
            0.33,
        )],
    )
    assert payload["status"] == "retrieved"
    assert payload["passages"][0]["chunk_id"] == 1
    assert len(calls) == 1


def test_retrieval_failure_does_not_say_the_constitution_is_missing(
    db_session,
    monkeypatch,
):
    member = _member(
        db_session,
        email="retrieval-failed@semo.edu",
        role=MemberRole.GENERAL,
        student_id="61000305",
    )

    def explode(*_args, **_kwargs):
        raise RuntimeError("search unavailable")

    monkeypatch.setattr("app.services.ai_chat_service.get_settings", lambda: _Settings())
    monkeypatch.setattr(
        "app.services.ai_chat_tools.constitution_index_has_chunks",
        lambda _db: True,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.organization_has_document_chunks",
        lambda _db: True,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.generate_embeddings",
        lambda _texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_tools.search_constitution_chunks",
        explode,
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_org_document_chunks",
        explode,
    )
    context, sources, _messages = _prepare_chat_context(
        db_session,
        member=member,
        data=ChatRequest(message="What is the election process?"),
    )
    assert sources == []
    assert "Additional organization document retrieval failed." in context
    assert "Do not infer that the constitution is missing." in context
    payload, calls = _search_for_test(
        db_session, member, monkeypatch, [], fail=True,
    )
    assert payload["error"] == "retrieval_failed"
    assert "search unavailable" not in json.dumps(payload)
    assert len(calls) == 1


@pytest.mark.parametrize(
    "account_type",
    ["general", "board", "vp", "treasurer", "president", "owner"],
)
def test_event_budget_access_metadata_by_account(db_session, account_type):
    creator = create_board_member(
        db_session,
        email="budget-metadata-creator@semo.edu",
        student_id="61900100",
    )
    event = _public_event(db_session, creator)

    factories = {
        "board": create_board_member,
        "vp": create_vice_president_member,
        "treasurer": create_treasurer_member,
        "president": create_president_member,
    }

    email = f"budget-metadata-{account_type}@semo.edu"

    if account_type in factories:
        member = factories[account_type](
            db_session,
            email=email,
            student_id="61900101",
        )
    else:
        member = _member(
            db_session,
            email=email,
            role=MemberRole.GENERAL,
            student_id="61900101",
        )
        if account_type == "owner":
            member = _attach_owner(db_session, member)

    listed = json.loads(execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="list_upcoming_events",
        tool_input={"limit": 10},
    ))

    details = json.loads(execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_event_details",
        tool_input={"event_id": event.id},
    ))

    listed_event = next(
        item for item in listed if item["id"] == event.id
    )

    for payload in (listed_event, details):
        assert payload["title"] == event.title
        assert payload["location"] == event.location

        if account_type == "general":
            assert payload["budget_access"] == "restricted"
            assert "budget" not in payload
            assert "1250" not in json.dumps(payload)
        else:
            assert payload["budget_access"] == "authorized"
            assert payload["budget"] == "1250.00"
