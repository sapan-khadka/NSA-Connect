from sqlalchemy.orm import Session

from app.models.finance_entry import FinanceEntry
from app.models.member import Member
from app.schemas.finance import FinanceEntryCreateRequest


def create_finance_entry(
    db: Session,
    data: FinanceEntryCreateRequest,
    *,
    created_by: Member,
) -> FinanceEntry:
    entry = FinanceEntry(
        entry_type=data.entry_type,
        category=data.category,
        amount=data.amount,
        description=data.description,
        receipt_url=data.receipt_url,
        created_by_id=created_by.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
