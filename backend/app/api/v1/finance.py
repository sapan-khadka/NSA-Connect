from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_treasurer
from app.lib.semester import SEMESTER_QUERY_PATTERN
from app.models.finance_entry import FinanceEntryType
from app.models.member import Member
from app.schemas.finance import (
    FinanceEntryCreateRequest,
    FinanceEntryListResponse,
    FinanceEntryResponse,
    FinanceSummaryResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.finance_service import (
    create_finance_entry,
    get_finance_summary,
    list_finance_entries,
)

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/summary", response_model=FinanceSummaryResponse)
def finance_summary_endpoint(
    semester: str | None = Query(
        default=None,
        pattern=SEMESTER_QUERY_PATTERN,
        description="Limit totals to a semester slug, e.g. 2026-spring",
    ),
    db: Session = Depends(get_db),
    _: Member = Depends(require_treasurer),
):
    return get_finance_summary(db, semester=semester)


@router.get("", response_model=FinanceEntryListResponse)
def list_finance_entries_endpoint(
    semester: str | None = Query(
        default=None,
        pattern=SEMESTER_QUERY_PATTERN,
        description="Filter by semester slug, e.g. 2026-spring",
    ),
    entry_type: FinanceEntryType | None = Query(
        default=None,
        alias="type",
        description="Filter by income or expense",
    ),
    event_id: int | None = Query(
        default=None,
        ge=1,
        description="Filter entries linked to an event",
    ),
    db: Session = Depends(get_db),
    _: Member = Depends(require_treasurer),
):
    entries, total = list_finance_entries(
        db,
        semester=semester,
        entry_type=entry_type,
        event_id=event_id,
    )
    return FinanceEntryListResponse(
        entries=[FinanceEntryResponse.from_entry(entry) for entry in entries],
        total=total,
    )


@router.post(
    "",
    response_model=FinanceEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_finance_entry_endpoint(
    data: FinanceEntryCreateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    try:
        entry = create_finance_entry(db, data, created_by=current_member)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return FinanceEntryResponse.from_entry(entry)
