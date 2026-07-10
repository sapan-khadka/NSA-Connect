from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.lib.finance_categories import normalize_finance_category
from app.models.finance_entry import FinanceEntryType

if TYPE_CHECKING:
    from app.models.finance_change_request import FinanceChangeRequest
    from app.models.finance_entry import FinanceEntry

MAX_FINANCE_AMOUNT = Decimal("999999.99")


class FinanceEntryCreateRequest(BaseModel):
    entry_type: FinanceEntryType
    category: str = Field(min_length=2, max_length=64)
    amount: Decimal = Field(gt=Decimal("0"), le=MAX_FINANCE_AMOUNT)
    description: str = Field(default="", max_length=5000)
    receipt_url: str | None = Field(default=None, max_length=2048)
    event_id: int | None = None

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return normalize_finance_category(value)

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


class FinanceEntryUpdateRequest(BaseModel):
    entry_type: FinanceEntryType | None = None
    category: str | None = Field(default=None, min_length=2, max_length=64)
    amount: Decimal | None = Field(default=None, gt=Decimal("0"), le=MAX_FINANCE_AMOUNT)
    description: str | None = Field(default=None, max_length=5000)
    receipt_url: str | None = Field(default=None, max_length=2048)
    event_id: int | None = None

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_finance_category(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
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
    def amount_must_have_two_decimal_places(
        cls, value: Decimal | None
    ) -> Decimal | None:
        if value is None:
            return None
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount must have at most two decimal places")
        return value


class FinanceEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_type: FinanceEntryType
    category: str
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


class FinanceSummaryBucket(BaseModel):
    income: Decimal
    expense: Decimal
    balance: Decimal
    entry_count: int


class FinanceEventSummary(BaseModel):
    event_id: int
    event_name: str
    income: Decimal
    expense: Decimal
    balance: Decimal
    entry_count: int


class FinanceEventBudgetSummary(BaseModel):
    event_id: int
    event_name: str
    planned_budget: Decimal
    actual_expense: Decimal
    actual_income: Decimal
    budget_remaining: Decimal
    over_budget: bool
    entry_count: int


class FinanceEventBudgetListResponse(BaseModel):
    events: list[FinanceEventBudgetSummary]
    total: int


class FinanceExpenseCategorySummary(BaseModel):
    category: str
    total_expense: Decimal
    entry_count: int


class FinanceExpenseCategoryListResponse(BaseModel):
    categories: list[FinanceExpenseCategorySummary]
    total_expense: Decimal


class FinanceSummaryResponse(BaseModel):
    balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    entry_count: int
    pre_event: FinanceSummaryBucket
    events: list[FinanceEventSummary]


class ReceiptUploadResponse(BaseModel):
    receipt_url: str
    public_id: str
    bytes: int
    format: str | None
    resource_type: str


class ReceiptScanResponse(BaseModel):
    """Structured fields extracted from a receipt photo for form pre-fill."""

    readable: bool
    vendor: str | None = None
    purchase_date: str | None = None
    purchase_time: str | None = None
    amount: Decimal | None = None
    description: str | None = None
    category: str | None = None
    confidence: str = "low"


class FinanceChangeRequestResponse(BaseModel):
    id: int
    entry_id: int
    action: str
    status: str
    payload: dict | None
    requested_by_id: int
    requested_by_name: str
    reviewed_by_id: int | None
    reviewed_by_name: str | None
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None
    entry_type: FinanceEntryType | None = None
    entry_amount: Decimal | None = None
    entry_description: str | None = None

    @classmethod
    def from_request(
        cls, request: "FinanceChangeRequest"
    ) -> "FinanceChangeRequestResponse":

        payload = None
        if request.payload:
            import json

            payload = json.loads(request.payload)

        entry = request.entry
        return cls(
            id=request.id,
            entry_id=request.entry_id,
            action=request.action.value,
            status=request.status.value,
            payload=payload,
            requested_by_id=request.requested_by_id,
            requested_by_name=request.requested_by.full_name
            if request.requested_by
            else "",
            reviewed_by_id=request.reviewed_by_id,
            reviewed_by_name=(
                request.reviewed_by.full_name if request.reviewed_by else None
            ),
            review_note=request.review_note,
            created_at=request.created_at,
            reviewed_at=request.reviewed_at,
            entry_type=entry.entry_type if entry else None,
            entry_amount=entry.amount if entry else None,
            entry_description=entry.description if entry else None,
        )


class FinanceChangeRequestListResponse(BaseModel):
    requests: list[FinanceChangeRequestResponse]
    total: int


class FinanceChangeRequestSummaryResponse(BaseModel):
    pending_count: int
    recently_rejected_count: int
    recently_approved_count: int


class FinanceMyChangeRequestsResponse(BaseModel):
    requests: list[FinanceChangeRequestResponse]
    total: int
    summary: FinanceChangeRequestSummaryResponse


class FinanceChangeRejectRequest(BaseModel):
    review_note: str | None = Field(default=None, max_length=5000)
