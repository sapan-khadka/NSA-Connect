from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.lib.semester import semester_date_range
from app.models.event import Event
from app.models.finance_entry import FinanceEntry, FinanceEntryType
from app.models.member import Member
from app.schemas.finance import (
    FinanceEntryCreateRequest,
    FinanceEventSummary,
    FinanceSummaryBucket,
    FinanceSummaryResponse,
)
from app.services.event_service import EventNotFoundError


def _semester_filters(semester: str | None) -> list:
    if semester is None:
        return []
    start, end = semester_date_range(semester)
    return [FinanceEntry.created_at >= start, FinanceEntry.created_at < end]


def _income_sum():
    return func.coalesce(
        func.sum(
            case(
                (FinanceEntry.entry_type == FinanceEntryType.INCOME, FinanceEntry.amount),
                else_=Decimal("0"),
            ),
        ),
        Decimal("0"),
    )


def _expense_sum():
    return func.coalesce(
        func.sum(
            case(
                (FinanceEntry.entry_type == FinanceEntryType.EXPENSE, FinanceEntry.amount),
                else_=Decimal("0"),
            ),
        ),
        Decimal("0"),
    )


def _bucket_from_row(income: Decimal, expense: Decimal, entry_count: int) -> FinanceSummaryBucket:
    income = Decimal(income)
    expense = Decimal(expense)
    return FinanceSummaryBucket(
        income=income,
        expense=expense,
        balance=income - expense,
        entry_count=entry_count,
    )


def get_finance_summary(
    db: Session,
    *,
    semester: str | None = None,
) -> FinanceSummaryResponse:
    filters = _semester_filters(semester)

    overall = db.execute(
        select(
            _income_sum(),
            _expense_sum(),
            func.count(FinanceEntry.id),
        ).where(*filters),
    ).one()
    total_income = Decimal(overall[0])
    total_expense = Decimal(overall[1])

    pre_event_row = db.execute(
        select(
            _income_sum(),
            _expense_sum(),
            func.count(FinanceEntry.id),
        ).where(FinanceEntry.event_id.is_(None), *filters),
    ).one()

    event_rows = db.execute(
        select(
            FinanceEntry.event_id,
            Event.title,
            _income_sum(),
            _expense_sum(),
            func.count(FinanceEntry.id),
        )
        .join(Event, FinanceEntry.event_id == Event.id)
        .where(FinanceEntry.event_id.is_not(None), *filters)
        .group_by(FinanceEntry.event_id, Event.title)
        .order_by(Event.title.asc()),
    ).all()

    return FinanceSummaryResponse(
        balance=total_income - total_expense,
        total_income=total_income,
        total_expense=total_expense,
        entry_count=overall[2],
        pre_event=_bucket_from_row(pre_event_row[0], pre_event_row[1], pre_event_row[2]),
        events=[
            FinanceEventSummary(
                event_id=row[0],
                event_name=row[1],
                income=Decimal(row[2]),
                expense=Decimal(row[3]),
                balance=Decimal(row[2]) - Decimal(row[3]),
                entry_count=row[4],
            )
            for row in event_rows
        ],
    )


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
