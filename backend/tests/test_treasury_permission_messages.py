import pytest

from app.schemas.ai import ChatToolCallRecord
from app.services.chat_finance_card import (
    TREASURY_PERMISSION_DENIED,
    TREASURY_UNAVAILABLE,
    treasury_unavailable_message,
)


def finance_record(output):
    return ChatToolCallRecord(
        tool_name="get_finance_summary",
        input={},
        output=output,
    )


def test_confirmed_permission_denial():
    records = [
        finance_record('{"error":"permission_denied"}')
    ]
    assert treasury_unavailable_message(
        records
    ) == TREASURY_PERMISSION_DENIED


@pytest.mark.parametrize(
    "output",
    [
        '{"error":"tool_failed"}',
        '{"error":"validation_error"}',
        '{"error":"not_found"}',
        '{"error":"unknown_tool"}',
        '{}',
        '[]',
        'null',
        'invalid JSON',
        '',
    ],
)
def test_other_failures_remain_unavailable(output):
    assert treasury_unavailable_message(
        [finance_record(output)]
    ) == TREASURY_UNAVAILABLE


def test_missing_finance_records():
    assert treasury_unavailable_message(
        []
    ) == TREASURY_UNAVAILABLE


def test_mixed_failures_do_not_claim_permission_denial():
    records = [
        finance_record('{"error":"permission_denied"}'),
        finance_record('{"error":"tool_failed"}'),
    ]
    assert treasury_unavailable_message(
        records
    ) == TREASURY_UNAVAILABLE


def test_unrelated_tool_denial_is_not_treasury_denial():
    records = [
        ChatToolCallRecord(
            tool_name="search_members",
            input={},
            output='{"error":"permission_denied"}',
        )
    ]
    assert treasury_unavailable_message(
        records
    ) == TREASURY_UNAVAILABLE
