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
    monkeypatch.setattr("app.services.ai_chat_service.generate_embeddings", embed)
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
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


def test_cosine_distance_uses_similarity_not_distance():
    assert cosine_similarity_from_distance(0) == 1
    assert cosine_similarity_from_distance(1) == 0
    assert cosine_similarity_from_distance(1.4) == 0


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
    assert "Officers must be elected." in context
    assert sources[0].excerpt == "Officers must be elected."
    assert sources[0].section == "Voting"


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
    )
    assert "Members pay semester dues." in context
    assert "Unrelated nearest neighbor." not in context
    assert "live" in context.lower()
    assert [source.chunk_id for source in sources] == [1]


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
    assert recorded[0] and recorded[1][0] == recorded[2][0]


def test_empty_document_library_skips_second_embedding(db_session, monkeypatch):
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
    assert len(embeds) == 1
    assert constitution_embeddings == [[0.1, 0.2, 0.3]]
    assert document_embeddings == []


def test_stale_assistant_history_is_not_sent_to_the_model(db_session, monkeypatch):
    member = create_board_member(db_session, email="history-board@semo.edu", student_id="61000005")
    monkeypatch.setattr(
        "app.services.ai_chat_service.generate_embeddings",
        lambda _texts: [[0.1, 0.2, 0.3]],
    )
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
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


def test_plain_board_and_owner_follow_existing_treasury_policy(db_session):
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
    assert "permission_denied" in _finance(db_session, board)
    assert "permission_denied" in _finance(db_session, owner)


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
    for payload in (listed, details):
        assert "Public Cultural Night" in payload
        assert "University Center" in details
        assert "1250" not in payload
        assert "budget" not in payload
    board_details = execute_chat_tool(
        db=db_session,
        member=creator,
        tool_name="get_event_details",
        tool_input={"event_id": event.id},
    )
    assert "1250.00" in board_details


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
        "app.services.ai_chat_service.search_constitution_chunks",
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
    assert "permission_denied" in treasury
    assert "5151.00" not in treasury
    assert "balance" not in treasury
