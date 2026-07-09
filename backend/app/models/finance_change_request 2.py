from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class FinanceChangeAction(StrEnum):
    UPDATE = "update"
    DELETE = "delete"


class FinanceChangeStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class FinanceChangeRequest(Base):
    __tablename__ = "finance_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("finance_entries.id"), nullable=False)
    action = Column(
        SqlEnum(
            FinanceChangeAction,
            values_callable=lambda actions: [action.value for action in actions],
        ),
        nullable=False,
    )
    status = Column(
        SqlEnum(
            FinanceChangeStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
        nullable=False,
        default=FinanceChangeStatus.PENDING,
        server_default=FinanceChangeStatus.PENDING.value,
    )
    payload = Column(Text, nullable=True)
    requested_by_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    reviewed_by_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    entry = relationship("FinanceEntry")
    requested_by = relationship("Member", foreign_keys=[requested_by_id])
    reviewed_by = relationship("Member", foreign_keys=[reviewed_by_id])
