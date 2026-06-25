from datetime import UTC, datetime
from decimal import Decimal

from app.models.finance_entry import (
    FinanceCategory,
    FinanceEntry,
    FinanceEntryType,
)


def test_finance_entry_table_name():
    assert FinanceEntry.__tablename__ == "finance_entries"


def test_finance_entry_income_signed_amount():
    entry = FinanceEntry(
        entry_type=FinanceEntryType.INCOME,
        category=FinanceCategory.FUNDRAISING,
        amount=Decimal("150.00"),
        description="Bake sale proceeds",
        receipt_url=None,
        created_by_id=1,
        created_at=datetime(2030, 3, 1, 12, 0, tzinfo=UTC),
    )

    assert entry.signed_amount == 150.0


def test_finance_entry_expense_signed_amount():
    entry = FinanceEntry(
        entry_type=FinanceEntryType.EXPENSE,
        category=FinanceCategory.FOOD_BEVERAGE,
        amount=Decimal("75.50"),
        description="Catering deposit",
        receipt_url="https://example.com/receipt.pdf",
        created_by_id=2,
        created_at=datetime(2030, 3, 1, 12, 0, tzinfo=UTC),
    )

    assert entry.signed_amount == -75.5
    assert entry.receipt_url == "https://example.com/receipt.pdf"


def test_finance_category_enum_values():
    assert FinanceCategory.MEMBERSHIP_DUES.value == "membership_dues"
    assert FinanceEntryType.INCOME.value == "income"
    assert FinanceEntryType.EXPENSE.value == "expense"
