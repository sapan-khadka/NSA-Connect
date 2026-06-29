from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_board, require_treasurer
from app.integrations.cloudinary_client import CloudinaryUploadError
from app.lib.semester import SEMESTER_QUERY_PATTERN
from app.models.finance_entry import FinanceEntryType
from app.models.member import Member
from app.schemas.finance import (
    FinanceChangeRejectRequest,
    FinanceChangeRequestListResponse,
    FinanceChangeRequestResponse,
    FinanceEntryCreateRequest,
    FinanceEntryListResponse,
    FinanceEntryResponse,
    FinanceEntryUpdateRequest,
    FinanceEventBudgetListResponse,
    FinanceEventBudgetSummary,
    FinanceExpenseCategoryListResponse,
    FinanceSummaryResponse,
    ReceiptUploadResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.finance_change_request_service import (
    FinanceChangeConflictError,
    FinanceChangeForbiddenError,
    FinanceChangeRequestNotFoundError,
    InvalidFinanceChangeStateError,
    approve_change_request,
    list_pending_for_reviewer,
    reject_change_request,
    submit_delete_request,
    submit_update_request,
)
from app.services.finance_service import (
    FinanceEntryNotFoundError,
    create_finance_entry,
    get_event_budget_breakdown,
    get_event_budget_for_event,
    get_expense_by_category,
    get_finance_summary,
    list_finance_entries,
)
from app.services.receipt_upload_service import (
    ReceiptUploadUnavailableError,
    ReceiptValidationError,
    upload_finance_receipt,
)

router = APIRouter(prefix="/finance", tags=["finance"])


@router.post(
    "/receipts",
    response_model=ReceiptUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_finance_receipt_endpoint(
    file: UploadFile = File(...),
    _: Member = Depends(require_treasurer),
):
    file_bytes = await file.read()

    try:
        result = upload_finance_receipt(
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
    except ReceiptValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except ReceiptUploadUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Receipt upload is not configured",
        ) from exc
    except CloudinaryUploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload receipt",
        ) from exc

    return ReceiptUploadResponse(
        receipt_url=result.receipt_url,
        public_id=result.public_id,
        bytes=result.bytes,
        format=result.format,
        resource_type=result.resource_type,
    )


@router.get("/expenses/by-category", response_model=FinanceExpenseCategoryListResponse)
def expense_by_category_endpoint(
    semester: str | None = Query(
        default=None,
        pattern=SEMESTER_QUERY_PATTERN,
        description="Filter expenses by entry semester slug, e.g. 2026-spring",
    ),
    db: Session = Depends(get_db),
    _: Member = Depends(require_board),
):
    return get_expense_by_category(db, semester=semester)


@router.get("/event-budgets", response_model=FinanceEventBudgetListResponse)
def event_budget_breakdown_endpoint(
    semester: str | None = Query(
        default=None,
        pattern=SEMESTER_QUERY_PATTERN,
        description="Filter events by start date semester slug, e.g. 2026-spring",
    ),
    db: Session = Depends(get_db),
    _: Member = Depends(require_board),
):
    events = get_event_budget_breakdown(db, semester=semester)
    return FinanceEventBudgetListResponse(events=events, total=len(events))


@router.get("/events/{event_id}/budget", response_model=FinanceEventBudgetSummary)
def event_budget_for_event_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    _: Member = Depends(require_board),
):
    try:
        return get_event_budget_for_event(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None


@router.get("/change-requests/pending", response_model=FinanceChangeRequestListResponse)
def list_pending_finance_change_requests(
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    requests = list_pending_for_reviewer(db, current_member)
    return FinanceChangeRequestListResponse(
        requests=[
            FinanceChangeRequestResponse.from_request(request) for request in requests
        ],
        total=len(requests),
    )


@router.post(
    "/change-requests/{request_id}/approve",
    response_model=FinanceChangeRequestResponse,
)
def approve_finance_change_request_endpoint(
    request_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    try:
        request = approve_change_request(db, request_id, current_member)
    except FinanceChangeRequestNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found",
        ) from None
    except FinanceChangeForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot approve this change request",
        ) from None
    except InvalidFinanceChangeStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
    except FinanceEntryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finance entry not found",
        ) from None
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return FinanceChangeRequestResponse.from_request(request)


@router.post(
    "/change-requests/{request_id}/reject",
    response_model=FinanceChangeRequestResponse,
)
def reject_finance_change_request_endpoint(
    request_id: int,
    data: FinanceChangeRejectRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    try:
        request = reject_change_request(
            db,
            request_id,
            current_member,
            review_note=data.review_note,
        )
    except FinanceChangeRequestNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found",
        ) from None
    except FinanceChangeForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot reject this change request",
        ) from None
    except InvalidFinanceChangeStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return FinanceChangeRequestResponse.from_request(request)


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


@router.patch("/{entry_id}", response_model=FinanceChangeRequestResponse, status_code=status.HTTP_202_ACCEPTED)
def update_finance_entry_endpoint(
    entry_id: int,
    data: FinanceEntryUpdateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    try:
        request = submit_update_request(db, entry_id, data, current_member)
    except FinanceEntryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finance entry not found",
        ) from None
    except FinanceChangeConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from None
    except FinanceChangeForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit this change request",
        ) from None
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return FinanceChangeRequestResponse.from_request(request)


@router.delete("/{entry_id}", response_model=FinanceChangeRequestResponse, status_code=status.HTTP_202_ACCEPTED)
def delete_finance_entry_endpoint(
    entry_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_treasurer),
):
    try:
        request = submit_delete_request(db, entry_id, current_member)
    except FinanceEntryNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finance entry not found",
        ) from None
    except FinanceChangeConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from None
    except FinanceChangeForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit this change request",
        ) from None

    return FinanceChangeRequestResponse.from_request(request)
