from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.core.embedding import EMBEDDING_DIMENSION
from app.models.constitutional_chunk import ConstitutionalChunk
from app.models.event import Event, EventType
from app.models.member import Member, MemberRole, MemberStatus
from app.services.ai_chat_tools import execute_chat_tool
from tests.helpers.anthropic_mocks import (
    build_mock_anthropic_text_response,
    build_mock_anthropic_tool_use_response,
    mock_claude_chat_api,
)


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


def _seed_event(db_session, *, title: str = "Dashain Celebration") -> Event:
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))
    if board is None:
        board = create_board_member(db_session)

    event = Event(
        title=title,
        description="Annual cultural celebration",
        event_type=EventType.CULTURAL,
        starts_at=datetime.now(UTC) + timedelta(days=14),
        budget=Decimal("500.00"),
        created_by_id=board.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def test_list_upcoming_events_tool_returns_events(db_session):
    event = _seed_event(db_session)
    board = db_session.scalar(select(Member).where(Member.email == "board@semo.edu"))

    result = execute_chat_tool(
        db=db_session,
        member=board,
        tool_name="list_upcoming_events",
        tool_input={"limit": 5},
    )

    assert event.title in result


def test_finance_tool_denies_general_member(db_session):
    general_member = Member(
        full_name="General Member",
        email="general@semo.edu",
        student_id="11111111",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(general_member)
    db_session.commit()

    result = execute_chat_tool(
        db=db_session,
        member=general_member,
        tool_name="get_finance_summary",
        tool_input={},
    )

    assert "permission_denied" in result


def test_approved_member_can_chat(client, general_member_headers, mock_claude_chat_api):
    response = client.post(
        "/api/v1/ai/chat",
        headers=general_member_headers,
        json={"message": "What events are coming up?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "here is your answer" in body["reply"].lower()
    assert body["tool_calls"] == []
    mock_claude_chat_api.messages.create.assert_called_once()


def test_chat_uses_tool_then_replies(
    client,
    general_member_headers,
    db_session,
    monkeypatch,
):
    _seed_event(db_session)
    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
        lambda *args, **kwargs: [],
    )

    with mock_claude_chat_api(
        responses=[
            build_mock_anthropic_tool_use_response(
                tool_name="list_upcoming_events",
                tool_input={"limit": 5},
            ),
            build_mock_anthropic_text_response(
                "There is one upcoming event: Dashain Celebration.",
            ),
        ],
    ):
        response = client.post(
            "/api/v1/ai/chat",
            headers=general_member_headers,
            json={"message": "What events are coming up?"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["tool_calls"][0]["tool_name"] == "list_upcoming_events"
    assert "Dashain Celebration" in body["tool_calls"][0]["output"]
    assert "Dashain Celebration" in body["reply"]


def test_chat_includes_constitution_sources(
    client,
    general_member_headers,
    db_session,
    monkeypatch,
):
    db_session.add(
        ConstitutionalChunk(
            section="Article I",
            chunk_index=0,
            content="Officers must be elected by a majority vote.",
            embedding=[1.0] + [0.0] * (EMBEDDING_DIMENSION - 1),
        )
    )
    db_session.commit()

    monkeypatch.setattr(
        "app.services.ai_chat_service.search_constitution_chunks",
        lambda db, query, limit: [
            type(
                "Hit",
                (),
                {
                    "id": 1,
                    "section": "Article I",
                    "chunk_index": 0,
                    "content": "Officers must be elected by a majority vote.",
                    "similarity_score": 0.91,
                },
            )()
        ],
    )

    with mock_claude_chat_api():
        response = client.post(
            "/api/v1/ai/chat",
            headers=general_member_headers,
            json={"message": "How are officers elected?"},
        )

    assert response.status_code == 200
    sources = response.json()["constitution_sources"]
    assert len(sources) == 1
    assert sources[0]["section"] == "Article I"


def test_chat_requires_authentication(client):
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "Hello"},
    )

    assert response.status_code == 401
