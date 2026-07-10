from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_treasury_writer
from app.lib.semester import SEMESTER_QUERY_PATTERN
from app.models.member import Member
from app.models.member_dues import DuesStatus
from app.schemas.dues import (
    DuesDashboardResponse,
    GenerateDuesRequest,
    GenerateDuesResponse,
    MarkDuesPaidRequest,
    MemberDuesResponse,
    MemberDuesUpdateRequest,
    MyDuesStatusResponse,
    SemesterDuesSettingsResponse,
    SemesterDuesSettingsUpdateRequest,
)
from app.services.dues_service import (
    DuesNotFoundError,
    DuesSettingsNotFoundError,
    InvalidDuesOperationError,
    generate_dues_records,
    get_dues_dashboard,
    get_my_dues_status,
    get_semester_settings,
    mark_dues_paid,
    mark_dues_unpaid,
    update_member_dues,
    upsert_semester_settings,
)

router = APIRouter(prefix="/finance/dues", tags=["dues"])


@router.get("", response_model=DuesDashboardResponse)
def get_dues_dashboard_endpoint(
    semester: str = Query(..., pattern=SEMESTER_QUERY_PATTERN),
    status_filter: DuesStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    _: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    return get_dues_dashboard(
        db,
        semester=semester,
        status_filter=status_filter,
        search=search,
    )


@router.get("/settings", response_model=SemesterDuesSettingsResponse)
def get_semester_dues_settings_endpoint(
    semester: str = Query(..., pattern=SEMESTER_QUERY_PATTERN),
    _: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    settings = get_semester_settings(db, semester)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default dues amount set for this semester.",
        )
    return SemesterDuesSettingsResponse.model_validate(settings)


@router.put("/settings", response_model=SemesterDuesSettingsResponse)
def upsert_semester_dues_settings_endpoint(
    payload: SemesterDuesSettingsUpdateRequest,
    current_member: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    try:
        return upsert_semester_settings(
            db,
            semester=payload.semester,
            default_amount=payload.default_amount,
            updated_by=current_member,
        )
    except InvalidDuesOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post("/generate", response_model=GenerateDuesResponse)
def generate_dues_records_endpoint(
    payload: GenerateDuesRequest,
    current_member: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    try:
        return generate_dues_records(
            db,
            semester=payload.semester,
            actor=current_member,
        )
    except DuesSettingsNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Set a default dues amount for this semester before generating records."
            ),
        ) from exc
    except InvalidDuesOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/mine", response_model=MyDuesStatusResponse)
def get_my_dues_status_endpoint(
    semester: str = Query(..., pattern=SEMESTER_QUERY_PATTERN),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        return get_my_dues_status(db, member_id=current_member.id, semester=semester)
    except InvalidDuesOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.patch("/{dues_id}", response_model=MemberDuesResponse)
def update_member_dues_endpoint(
    dues_id: int,
    payload: MemberDuesUpdateRequest,
    current_member: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    try:
        return update_member_dues(
            db,
            dues_id,
            actor=current_member,
            amount_owed=payload.amount_owed,
            amount_paid=payload.amount_paid,
            payment_method=payload.payment_method,
            note=payload.note,
            paid_at=payload.paid_at,
        )
    except DuesNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dues record not found."
        ) from exc
    except InvalidDuesOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post("/{dues_id}/mark-paid", response_model=MemberDuesResponse)
def mark_dues_paid_endpoint(
    dues_id: int,
    payload: MarkDuesPaidRequest,
    current_member: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    try:
        return mark_dues_paid(
            db,
            dues_id,
            actor=current_member,
            payment_method=payload.payment_method,
            paid_at=payload.paid_at,
            amount_paid=payload.amount_paid,
            note=payload.note,
        )
    except DuesNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dues record not found."
        ) from exc
    except InvalidDuesOperationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post("/{dues_id}/mark-unpaid", response_model=MemberDuesResponse)
def mark_dues_unpaid_endpoint(
    dues_id: int,
    current_member: Member = Depends(require_treasury_writer),
    db: Session = Depends(get_db),
):
    try:
        return mark_dues_unpaid(db, dues_id, actor=current_member)
    except DuesNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dues record not found."
        ) from exc
