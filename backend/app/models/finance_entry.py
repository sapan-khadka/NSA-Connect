from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class FinanceEntryType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class FinanceCategory(StrEnum):
    MEMBERSHIP_DUES = "membership_dues"
    FUNDRAISING = "fundraising"
    DONATION = "donation"
    SPONSORSHIP = "sponsorship"
    FOOD_BEVERAGE = "food_beverage"
    VENUE = "venue"
    SUPPLIES = "supplies"
    MARKETING = "marketing"
    TRAVEL = "travel"
    EVENT = "event"
    OTHER = "other"


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_type = Column(
        SqlEnum(
            FinanceEntryType,
            values_callable=lambda types: [entry_type.value for entry_type in types],
        ),
        nullable=False,
    )
    category = Column(
        SqlEnum(
            FinanceCategory,
            values_callable=lambda categories: [category.value for category in categories],
        ),
        nullable=False,
    )
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(Text, nullable=False, default="")
    receipt_url = Column(String(2048), nullable=True)
    created_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    created_by = relationship("Member")

    @property
    def signed_amount(self) -> float:
        value = float(self.amount)
        if self.entry_type == FinanceEntryType.EXPENSE:
            return -value
        return value
