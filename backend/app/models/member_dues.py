from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class DuesPaymentMethod(StrEnum):
    VENMO = "venmo"
    CASH = "cash"
    OTHER = "other"
    ONLINE = "online"


class DuesStatus(StrEnum):
    PAID = "paid"
    UNPAID = "unpaid"
    PARTIAL = "partial"
    EXEMPT = "exempt"


class SemesterDuesSettings(Base):
    __tablename__ = "semester_dues_settings"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "semester",
            name="uq_semester_dues_settings_org_semester",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    semester = Column(String(16), nullable=False)
    default_amount = Column(Numeric(10, 2), nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    updated_by = relationship("Member")


class MemberDues(Base):
    __tablename__ = "member_dues"
    __table_args__ = (
        UniqueConstraint(
            "member_id", "semester", name="uq_member_dues_member_semester"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    member_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    semester = Column(String(16), nullable=False, index=True)
    amount_owed = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False, default=0)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    payment_method = Column(
        SqlEnum(
            DuesPaymentMethod,
            values_callable=lambda types: [method.value for method in types],
        ),
        nullable=True,
    )
    note = Column(Text, nullable=True)
    finance_entry_id = Column(Integer, ForeignKey("finance_entries.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    member = relationship("Member")
    finance_entry = relationship("FinanceEntry")

    @staticmethod
    def compute_status(amount_owed, amount_paid) -> DuesStatus:
        owed = float(amount_owed)
        paid = float(amount_paid)
        if owed <= 0:
            return DuesStatus.EXEMPT
        if paid >= owed:
            return DuesStatus.PAID
        if paid > 0:
            return DuesStatus.PARTIAL
        return DuesStatus.UNPAID
