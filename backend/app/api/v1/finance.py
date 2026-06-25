from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_treasurer
from app.integrations.cloudinary_client import CloudinaryUploadError
from app.lib.semester import SEMESTER_QUERY_PATTERN
from app.models.finance_entry import FinanceEntryType
from app.models.member import Member
from app.schemas.finance import (
    FinanceEntryCreateRequest,
    FinanceEntryListResponse,
    FinanceEntryResponse,
    FinanceSummaryResponse,
    ReceiptUploadResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.finance_service import (
    create_finance_entry,
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
