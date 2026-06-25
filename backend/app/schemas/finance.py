from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.finance_entry import FinanceCategory, FinanceEntryType

if TYPE_CHECKING:
    from app.models.finance_entry import FinanceEntry

MAX_FINANCE_AMOUNT = Decimal("999999.99")


class FinanceEntryCreateRequest(BaseModel):
    entry_type: FinanceEntryType
    category: FinanceCategory
    amount: Decimal = Field(gt=Decimal("0"), le=MAX_FINANCE_AMOUNT)
    description: str = Field(default="", max_length=5000)
    receipt_url: str | None = Field(default=None, max_length=2048)
    event_id: int | None = None

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("receipt_url", mode="before")
    @classmethod
    def normalize_receipt_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
        return value or None

    @field_validator("amount")
    @classmethod
    def amount_must_have_two_decimal_places(cls, value: Decimal) -> Decimal:
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount must have at most two decimal places")
        return value


class FinanceEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_type: FinanceEntryType
    category: FinanceCategory
    amount: Decimal
    description: str
    receipt_url: str | None
    event_id: int | None
    created_by_id: int
    created_at: datetime

    @classmethod
    def from_entry(cls, entry: "FinanceEntry") -> "FinanceEntryResponse":
        return cls(
            id=entry.id,
            entry_type=entry.entry_type,
            category=entry.category,
            amount=entry.amount,
            description=entry.description,
            receipt_url=entry.receipt_url,
            event_id=entry.event_id,
            created_by_id=entry.created_by_id,
            created_at=entry.created_at,
        )


class FinanceEntryListResponse(BaseModel):
    entries: list[FinanceEntryResponse]
    total: int
