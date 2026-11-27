"""Deterministic treasury cards and owner read access for the assistant."""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from conftest import (
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    create_president_member,
    create_treasurer_member,
    create_vice_president_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import select

from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.schemas.ai import ChatRequest, ChatToolCallRecord
from app.services.ai_chat_service import chat_with_nsa_assistant
from app.services.ai_chat_tools import execute_chat_tool
from app.services.chat_finance_card import (
    TREASURY_NOTE,
    TREASURY_UNAVAILABLE,
    finance_card_from_tool_output,
    money_string,
    public_tool_records,
)
from app.services.organization_context import (
    ensure_membership_for_member,
    get_default_organization_id,
)
from tests.helpers.anthropic_mocks import (
    build_mock_anthropic_text_response,
    build_mock_anthropic_tool_use_response,
    mock_claude_chat_api,
)

FINANCE_POST_PAYLOAD = {
    "entry_type": "income",
    "category": "fundraising",
    "amount": "150.00",
    "description": "Bake sale proceeds",
}
WRONG_TOTAL = "224.85"


def test_money_string_keeps_exact_cents_and_sign():
    assert money_string("0") == "0.00"
    assert money_string("0.00") == "0.00"
    assert money_string(Decimal("224.74")) == "224.74"
    assert money_string("-224.74") == "-224.74"
    assert money_string("10.50") == "10.50"
    assert money_string("224.745") is None
    assert money_string("not-a-number") is None
    assert money_string(None) is None


def test_invalid_finance_payloads_produce_no_card():
    assert finance_card_from_tool_output("not-json", tool_input={}) is None
    assert (
        finance_card_from_tool_output(
            json.dumps({"error": "permission_denied", "detail": "no"}),
            tool_input={},
        )
        is None
    )
    assert (
        finance_card_from_tool_output(
            json.dumps({"error": "tool_failed", "detail": "no"}),
            tool_input={},
        )
        is None
    )
    assert (
        finance_card_from_tool_output(
            json.dumps(
                {
                    "total_income": "0.00",
                    "total_expense": "1.00",
                    "balance": "-1.00",
                }
            ),
            tool_input={},
        )
        is None
    )


def _seed_entries(db_session, treasurer: Member, rows: list[tuple]) -> None:
    org_id = get_default_organization_id(db_session)
    event_ids: dict[str, int] = {}
    for entry_type, amount, event_title in rows:
        event_id = None
        if event_title is not None:
            if event_title not in event_ids:
                event = Event(
                    title=event_title,
                    description="Chapter event",
                    event_type=EventType.CULTURAL,
                    starts_at=datetime(2030, 6, 1, 18, 0, tzinfo=UTC),
                    budget=Decimal("250.00"),
                    created_by_id=treasurer.id,
                    organization_id=org_id,
                )
                db_session.add(event)
                db_session.flush()
                event_ids[event_title] = event.id
            event_id = event_ids[event_title]
        db_session.add(
            FinanceEntry(
                entry_type=entry_type,
                category=FinanceCategory.EVENT,
                amount=Decimal(amount),
                description="Ledger row",
                event_id=event_id,
                created_by_id=treasurer.id,
                organization_id=org_id,
                created_at=datetime(2030, 4, 1, 12, 0, tzinfo=UTC),
            )
        )
    db_session.commit()


def _chat(
    db_session,
    member: Member,
    *,
    message: str,
    follow_up: str,
    wrong_draft: str = f"Total expenses are ${WRONG_TOTAL}.",
):
    responses = [
        build_mock_anthropic_tool_use_response(
            tool_name="get_finance_summary",
            tool_input={},
        ),
        build_mock_anthropic_text_response(wrong_draft),
        build_mock_anthropic_text_response(follow_up),
    ]
    with mock_claude_chat_api(responses=responses):
        return chat_with_nsa_assistant(
            db_session,
            member=member,
            data=ChatRequest(message=message),
        )


def test_reported_totals_become_exact_card_and_drop_model_total(db_session):
    treasurer = create_treasurer_member(
        db_session,
        email="card-treasurer@semo.edu",
        student_id="61001001",
    )
    _seed_entries(
        db_session,
        treasurer,
        [
            (FinanceEntryType.EXPENSE, "29.89", None),
            (FinanceEntryType.EXPENSE, "194.85", "TEEJ Celebration"),
        ],
    )
    response = _chat(
        db_session,
        treasurer,
        message="What is our treasury balance?",
        follow_up="NONE",
    )
    card = response.finance_summary
    assert card is not None
    assert card.currency == "USD"
    assert card.period_label == "All recorded activity"
    assert card.total_income == "0.00"
    assert card.total_expense == "224.74"
    assert card.balance == "-224.74"
    assert [(line.label, line.expense) for line in card.breakdown] == [
        ("Pre-event and general", "29.89"),
        ("TEEJ Celebration", "194.85"),
    ]
    assert response.reply == TREASURY_NOTE
    assert WRONG_TOTAL not in response.reply
    payload = response.model_dump(mode="json")
    assert WRONG_TOTAL not in json.dumps(payload)
    finance_tool = payload["tool_calls"][0]
    assert finance_tool["tool_name"] == "get_finance_summary"
    assert finance_tool["output"] == ""
    assert "entry_count" not in json.dumps(payload)


def test_zero_and_positive_balances_keep_two_decimals(db_session):
    treasurer = create_treasurer_member(
        db_session,
        email="card-signs@semo.edu",
        student_id="61001002",
    )
    empty = execute_chat_tool(
        db=db_session,
        member=treasurer,
        tool_name="get_finance_summary",
        tool_input={"semester": "2030-spring"},
    )
    empty_card = finance_card_from_tool_output(
        empty,
        tool_input={"semester": "2030-spring"},
    )
    assert empty_card is not None
    assert empty_card.period_label == "2030-spring"
    assert empty_card.total_income == "0.00"
    assert empty_card.total_expense == "0.00"
    assert empty_card.balance == "0.00"
    assert empty_card.breakdown[0].expense == "0.00"

    _seed_entries(
        db_session,
        treasurer,
        [
            (FinanceEntryType.INCOME, "10.50", None),
            (FinanceEntryType.EXPENSE, "4.25", None),
        ],
    )
    positive = execute_chat_tool(
        db=db_session,
        member=treasurer,
        tool_name="get_finance_summary",
        tool_input={},
    )
    positive_card = finance_card_from_tool_output(positive, tool_input={})
    assert positive_card is not None
    assert positive_card.total_income == "10.50"
    assert positive_card.total_expense == "4.25"
    assert positive_card.balance == "6.25"


def test_mixed_question_keeps_constitution_dues_and_hides_wrong_total(db_session):
    treasurer = create_treasurer_member(
        db_session,
        email="card-mixed@semo.edu",
        student_id="61001003",
    )
    _seed_entries(
        db_session,
        treasurer,
        [
            (FinanceEntryType.EXPENSE, "29.89", None),
            (FinanceEntryType.EXPENSE, "194.85", "TEEJ Celebration"),
        ],
    )
    dues_answer = "The constitution says members pay semester dues of $20."
    response = _chat(
        db_session,
        treasurer,
        message="What is the treasury balance, and what does the constitution say about dues?",
        follow_up=dues_answer,
    )
    assert response.finance_summary is not None
    assert response.finance_summary.total_expense == "224.74"
    assert response.reply == dues_answer
    assert "$20" in response.reply
    assert WRONG_TOTAL not in response.reply
    assert WRONG_TOTAL not in json.dumps(response.model_dump(mode="json"))


def test_denied_and_malformed_finance_tools_show_no_card(db_session, monkeypatch):
    general = Member(
        full_name="General Reader",
        email="card-general@semo.edu",
        student_id="61001004",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(general)
    db_session.commit()
    denied = _chat(
        db_session,
        general,
        message="What is our treasury balance?",
        follow_up="NONE",
        wrong_draft="The balance is $224.85.",
    )
    assert denied.finance_summary is None
    assert denied.reply == TREASURY_UNAVAILABLE
    assert WRONG_TOTAL not in denied.reply

    treasurer = create_treasurer_member(
        db_session,
        email="card-malformed@semo.edu",
        student_id="61001005",
    )

    def malformed_tool(**kwargs):
        if kwargs["tool_name"] == "get_finance_summary":
            return "not-json"
        return json.dumps({"error": "unknown_tool"})

    monkeypatch.setattr(
        "app.services.ai_chat_service.execute_chat_tool",
        malformed_tool,
    )
    failed = _chat(
        db_session,
        treasurer,
        message="What is our treasury balance?",
        follow_up="NONE",
    )
    assert failed.finance_summary is None
    assert failed.reply == TREASURY_UNAVAILABLE
    assert WRONG_TOTAL not in json.dumps(failed.model_dump(mode="json"))


def _tool(db_session, member: Member, tool_name: str, tool_input: dict) -> str:
    return execute_chat_tool(
        db=db_session,
        member=member,
        tool_name=tool_name,
        tool_input=tool_input,
    )


@pytest.mark.parametrize(
    ("factory", "email", "student_id"),
    [
        (create_president_member, "read-president@semo.edu", "61001011"),
        (create_vice_president_member, "read-vp@semo.edu", "61001012"),
        (create_treasurer_member, "read-treasurer@semo.edu", "61001013"),
    ],
)
def test_finance_officers_can_read_dues_tools(db_session, factory, email, student_id):
    member = factory(db_session, email=email, student_id=student_id)
    assert "permission_denied" not in _tool(
        db_session, member, "get_dues_summary", {}
    )
    assert "permission_denied" not in _tool(
        db_session,
        member,
        "get_member_dues",
        {"name": "Nobody Special"},
    )


def test_owner_can_read_treasury_and_dues_tools(db_session):
    member = Member(
        full_name="Org Owner",
        email="read-owner@semo.edu",
        student_id="61001014",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        position=MemberPosition.MEMBER,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    membership = ensure_membership_for_member(db_session, member)
    membership.is_org_owner = True
    db_session.commit()
    member._active_membership = membership
    for tool_name, tool_input in (
        ("get_finance_summary", {}),
        ("get_dues_summary", {}),
        ("get_member_dues", {"name": "Nobody Special"}),
    ):
        result = _tool(db_session, member, tool_name, tool_input)
        assert "permission_denied" not in result


def test_board_secretary_and_general_cannot_read_restricted_treasury_tools(db_session):
    board = create_board_member(
        db_session,
        email="read-board@semo.edu",
        student_id="61001015",
    )
    secretary = create_board_member(
        db_session,
        email="read-secretary@semo.edu",
        student_id="61001016",
    )
    secretary.position = MemberPosition.SECRETARY
    membership = ensure_membership_for_member(db_session, secretary)
    membership.position = MemberPosition.SECRETARY
    secretary._active_membership = membership
    db_session.commit()
    general = Member(
        full_name="General Member",
        email="read-general@semo.edu",
        student_id="61001017",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(general)
    db_session.commit()

    for member in (board, secretary, general):
        for tool_name, tool_input in (
            ("get_finance_summary", {}),
            ("get_dues_summary", {}),
            ("get_member_dues", {"name": "Nobody Special"}),
        ):
            result = _tool(db_session, member, tool_name, tool_input)
            assert "permission_denied" in result
            assert "balance" not in result
            assert "amount_owed" not in result


def test_general_member_can_read_own_dues(db_session):
    member = Member(
        full_name="Own Dues",
        email="own-dues@semo.edu",
        student_id="61001018",
        major="Biology",
        graduation_year=2028,
        hashed_password="hashed",
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    result = _tool(db_session, member, "get_my_dues", {})
    assert "permission_denied" not in result
    assert "has_record" in result


def test_owner_and_board_cannot_write_finance_and_treasurer_can(client, db_session):
    register_member(client, email="write-owner@semo.edu", student_id="61001021")
    set_member_approved(db_session, email="write-owner@semo.edu")
    owner = db_session.scalar(select(Member).where(Member.email == "write-owner@semo.edu"))
    membership = ensure_membership_for_member(db_session, owner)
    membership.is_org_owner = True
    db_session.commit()
    owner_headers = auth_header(client, email="write-owner@semo.edu", password=VALID_PASSWORD)
    owner_response = client.post(
        "/api/v1/finance",
        headers=owner_headers,
        json=FINANCE_POST_PAYLOAD,
    )
    assert owner_response.status_code == 403
    assert owner_response.json()["detail"] == (
        "Requires treasurer, president, or vice president"
    )

    register_member(client, email="write-other@semo.edu", student_id="61001022")
    create_board_member(db_session, email="write-board@semo.edu", student_id="61001023")
    board_headers = auth_header(client, email="write-board@semo.edu", password=VALID_PASSWORD)
    board_response = client.post(
        "/api/v1/finance",
        headers=board_headers,
        json=FINANCE_POST_PAYLOAD,
    )
    assert board_response.status_code == 403

    create_treasurer_member(
        db_session,
        email="write-treasurer@semo.edu",
        student_id="61001024",
    )
    treasurer_headers = auth_header(
        client,
        email="write-treasurer@semo.edu",
        password=VALID_PASSWORD,
    )
    treasurer_response = client.post(
        "/api/v1/finance",
        headers=treasurer_headers,
        json=FINANCE_POST_PAYLOAD,
    )
    assert treasurer_response.status_code == 201


def test_public_record_helper_drops_raw_ledger_json():
    raw = json.dumps(
        {
            "total_income": "0.00",
            "total_expense": "224.74",
            "balance": "-224.74",
            "entry_count": 2,
            "pre_event": {
                "income": "0.00",
                "expense": "29.89",
                "balance": "-29.89",
                "entry_count": 1,
            },
            "events": [],
        }
    )
    record = ChatToolCallRecord(
        tool_name="get_finance_summary",
        input={},
        output=raw,
    )
    published = public_tool_records([record])[0]
    assert published.output == ""
    assert "224.74" not in published.output
