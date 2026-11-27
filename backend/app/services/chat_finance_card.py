"""Build the assistant treasury card from an authorized tool result.

The card is the only treasury summary shown to the caller. It is assembled
from the ledger tool JSON with decimal strings, and it is not derived from
model prose.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any

from app.lib.semester import SEMESTER_QUERY_PATTERN
from app.schemas.ai import (
    ChatFinanceBreakdownLine,
    ChatFinanceSummaryCard,
    ChatToolCallRecord,
)

FINANCE_SUMMARY_TOOL = "get_finance_summary"
TREASURY_NOTE = "Here is the chapter treasury summary."
TREASURY_UNAVAILABLE = "The treasury summary is unavailable."
NON_TREASURY_SENTINEL = "NONE"
_MONEY = Decimal("0.01")
_LABEL_LIMIT = 120


def money_string(value: object) -> str | None:
    """Return an exact cent string, or None when the value is not exact cents."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        amount = Decimal(str(value))
    except Exception:
        return None
    if not amount.is_finite():
        return None
    cents = amount.quantize(_MONEY)
    if cents != amount:
        return None
    return f"{cents:.2f}"


def period_label(tool_input: dict[str, Any] | None) -> str:
    semester = tool_input.get("semester") if isinstance(tool_input, dict) else None
    if isinstance(semester, str) and re.fullmatch(SEMESTER_QUERY_PATTERN, semester):
        return semester
    return "All recorded activity"


def finance_card_from_tool_output(
    output: str,
    *,
    tool_input: dict[str, Any] | None,
) -> ChatFinanceSummaryCard | None:
    """Parse a successful get_finance_summary payload. Invalid data yields None."""
    try:
        payload = json.loads(output)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or "error" in payload:
        return None

    total_income = money_string(payload.get("total_income"))
    total_expense = money_string(payload.get("total_expense"))
    balance = money_string(payload.get("balance"))
    pre_event = payload.get("pre_event")
    events = payload.get("events")
    if (
        total_income is None
        or total_expense is None
        or balance is None
        or total_income.startswith("-")
        or total_expense.startswith("-")
        or not isinstance(pre_event, dict)
        or not isinstance(events, list)
    ):
        return None

    pre_event_expense = money_string(pre_event.get("expense"))
    if pre_event_expense is None or pre_event_expense.startswith("-"):
        return None

    breakdown = [
        ChatFinanceBreakdownLine(
            label="Pre-event and general",
            expense=pre_event_expense,
        )
    ]
    for event in events:
        if not isinstance(event, dict):
            return None
        name = event.get("event_name")
        expense = money_string(event.get("expense"))
        if not isinstance(name, str) or not name.strip():
            return None
        if expense is None or expense.startswith("-"):
            return None
        breakdown.append(
            ChatFinanceBreakdownLine(
                label=name.strip()[:_LABEL_LIMIT],
                expense=expense,
            )
        )

    return ChatFinanceSummaryCard(
        currency="USD",
        period_label=period_label(tool_input),
        total_income=total_income,
        total_expense=total_expense,
        balance=balance,
        breakdown=breakdown,
    )


def finance_summary_records(
    tool_records: list[ChatToolCallRecord],
) -> list[ChatToolCallRecord]:
    return [
        record
        for record in tool_records
        if record.tool_name == FINANCE_SUMMARY_TOOL
    ]


def authorized_finance_card(
    tool_records: list[ChatToolCallRecord],
) -> ChatFinanceSummaryCard | None:
    card: ChatFinanceSummaryCard | None = None
    for record in finance_summary_records(tool_records):
        parsed = finance_card_from_tool_output(
            record.output,
            tool_input=record.input if isinstance(record.input, dict) else None,
        )
        if parsed is not None:
            card = parsed
    return card


def public_tool_records(
    tool_records: list[ChatToolCallRecord],
) -> list[ChatToolCallRecord]:
    """Drop raw ledger JSON from the payload sent to the browser."""
    published: list[ChatToolCallRecord] = []
    for record in tool_records:
        if record.tool_name == FINANCE_SUMMARY_TOOL:
            published.append(
                ChatToolCallRecord(
                    tool_name=record.tool_name,
                    input=record.input,
                    output="",
                )
            )
        else:
            published.append(record)
    return published


def non_treasury_instruction(*, ledger_available: bool) -> str:
    if ledger_available:
        availability = (
            "The application is displaying the ledger treasury summary separately."
        )
    else:
        availability = "No ledger treasury summary is available for this request."
    return (
        f"{availability} Write only the non-treasury part of the latest user "
        "question, such as a constitutional answer. Membership dues stated in "
        "the constitution may be included. Do not state a treasury balance, "
        f"income total, or expense total. If nothing else was asked, reply with "
        f"exactly {NON_TREASURY_SENTINEL}."
    )


def prose_after_finance_separation(text: str, *, ledger_available: bool) -> str:
    cleaned = text.strip()
    if cleaned.casefold() in {NON_TREASURY_SENTINEL.casefold(), "none."}:
        cleaned = ""
    if ledger_available:
        return cleaned or TREASURY_NOTE
    if not cleaned:
        return TREASURY_UNAVAILABLE
    return f"{cleaned}\n\n{TREASURY_UNAVAILABLE}"
