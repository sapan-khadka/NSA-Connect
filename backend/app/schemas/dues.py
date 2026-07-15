from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.member_dues import DuesPaymentMethod, DuesStatus


class SemesterDuesSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    semester: str
    default_amount: Decimal


class SemesterDuesSettingsUpdateRequest(BaseModel):
    semester: str = Field(..., pattern=r"^(19|20)\d{2}-(spring|summer|fall)$")
    default_amount: Decimal = Field(..., ge=0)

    @field_validator("default_amount")
    @classmethod
    def amount_must_have_two_decimal_places(cls, value: Decimal) -> Decimal:
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount must have at most two decimal places")
        return value


class GenerateDuesRequest(BaseModel):
    semester: str = Field(..., pattern=r"^(19|20)\d{2}-(spring|summer|fall)$")


class GenerateDuesResponse(BaseModel):
    semester: str
    created_count: int
    skipped_count: int
    default_amount: Decimal


class MemberDuesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    member_name: str
    member_email: str
    semester: str
    amount_owed: Decimal
    amount_paid: Decimal
    status: DuesStatus
    paid_at: datetime | None
    payment_method: DuesPaymentMethod | None
    note: str | None
    finance_entry_id: int | None


class DuesDashboardSummary(BaseModel):
    semester: str
    default_amount: Decimal | None
    total_expected: Decimal
    total_collected: Decimal
    total_outstanding: Decimal
    paid_count: int
    unpaid_count: int
    partial_count: int
    exempt_count: int
    member_count: int


class DuesDashboardResponse(BaseModel):
    summary: DuesDashboardSummary
    records: list[MemberDuesResponse]


class MemberDuesUpdateRequest(BaseModel):
    amount_owed: Decimal | None = Field(default=None, ge=0)
    amount_paid: Decimal | None = Field(default=None, ge=0)
    payment_method: DuesPaymentMethod | None = None
    note: str | None = None
    paid_at: datetime | None = None

    @field_validator("amount_owed", "amount_paid")
    @classmethod
    def amount_must_have_two_decimal_places(
        cls,
        value: Decimal | None,
    ) -> Decimal | None:
        if value is None:
            return None
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount must have at most two decimal places")
        return value


class MarkDuesPaidRequest(BaseModel):
    payment_method: DuesPaymentMethod
    paid_at: datetime | None = None
    amount_paid: Decimal | None = Field(default=None, ge=0)
    note: str | None = None

    @field_validator("amount_paid")
    @classmethod
    def amount_must_have_two_decimal_places(
        cls,
        value: Decimal | None,
    ) -> Decimal | None:
        if value is None:
            return None
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Amount must have at most two decimal places")
        return value


class MyDuesStatusResponse(BaseModel):
    semester: str
    amount_owed: Decimal | None
    amount_paid: Decimal | None
    status: DuesStatus | None
    has_record: bool
    # Simple addition so members can see when their own payment was recorded.
    paid_at: datetime | None = None


class MemberDuesHistoryItemResponse(BaseModel):
    id: int
    member_id: int
    semester: str
    amount_owed: Decimal
    amount_paid: Decimal
    status: DuesStatus
    paid_at: datetime | None


class MemberDuesHistoryResponse(BaseModel):
    member_id: int
    records: list[MemberDuesHistoryItemResponse]
    total: int
