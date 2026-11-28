import pytest

from app.schemas.ai import ChatFinanceSummaryCard
from app.services.chat_finance_card import treasury_summary_prose


@pytest.mark.parametrize(
    "balance,income,expense,expected",
    [
        ("-224.74", "0.00", "224.74",
         "a treasury deficit of $224.74"),
        ("750.00", "1000.00", "250.00",
         "a positive treasury balance of $750.00"),
        ("0.00", "100.00", "100.00",
         "a treasury balance of $0.00"),
        ("12345.67", "13000.00", "654.33",
         "a positive treasury balance of $12,345.67"),
    ],
)
def test_treasury_summary_prose(
    balance, income, expense, expected,
):
    card = ChatFinanceSummaryCard(
        currency="USD",
        period_label="All recorded activity",
        total_income=income,
        total_expense=expense,
        balance=balance,
        breakdown=[],
    )

    reply = treasury_summary_prose(card)

    assert expected in reply
    assert reply.startswith("Across all recorded activity")
    assert "permission" not in reply.lower()
    assert "tool" not in reply.lower()


def test_treasury_summary_preserves_reporting_period():
    card = ChatFinanceSummaryCard(
        currency="USD",
        period_label="Fall 2026",
        total_income="100.00",
        total_expense="25.00",
        balance="75.00",
        breakdown=[],
    )

    reply = treasury_summary_prose(card)

    assert reply.startswith("For Fall 2026")
    assert "$75.00" in reply
    assert "$100.00" in reply
    assert "$25.00" in reply
