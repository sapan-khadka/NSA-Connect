from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.lib.semester import semester_date_range
from app.models.event import Event
from app.models.finance_entry import FinanceEntry, FinanceEntryType
from app.models.member import Member
from app.schemas.finance import FinanceEntryCreateRequest
from app.services.event_service import EventNotFoundError


def create_finance_entry(
    db: Session,
    data: FinanceEntryCreateRequest,
    *,
    created_by: Member,
) -> FinanceEntry:
    if data.event_id is not None and db.get(Event, data.event_id) is None:
        raise EventNotFoundError

    entry = FinanceEntry(
        entry_type=data.entry_type,
        category=data.category,
        amount=data.amount,
        description=data.description,
        receipt_url=data.receipt_url,
        event_id=data.event_id,
        created_by_id=created_by.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_finance_entries(
    db: Session,
    *,
    semester: str | None = None,
    entry_type: FinanceEntryType | None = None,
    event_id: int | None = None,
) -> tuple[list[FinanceEntry], int]:
    query = select(FinanceEntry)

    if semester is not None:
        start, end = semester_date_range(semester)
        query = query.where(FinanceEntry.created_at >= start)
        query = query.where(FinanceEntry.created_at < end)

    if entry_type is not None:
        query = query.where(FinanceEntry.entry_type == entry_type)

    if event_id is not None:
        query = query.where(FinanceEntry.event_id == event_id)

    entries = list(
        db.scalars(query.order_by(FinanceEntry.created_at.desc(), FinanceEntry.id.desc())).all(),
    )
    return entries, len(entries)
