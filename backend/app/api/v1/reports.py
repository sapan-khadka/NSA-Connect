from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.report import (
    ReportDetailResponse,
    ReportGenerateRequest,
    ReportListItemResponse,
    ReportListResponse,
)
from app.services.report_pdf_service import generate_report_pdf
from app.services.report_service import (
    ReportNotFoundError,
    generate_report,
    get_report,
    list_reports,
    load_report_data,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=ReportListResponse)
def list_reports_endpoint(
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    reports = list_reports(db)
    return ReportListResponse(
        reports=[
            ReportListItemResponse.from_report(
                report,
                generated_by_name=report.generated_by.full_name,
            )
            for report in reports
        ],
        total=len(reports),
    )


@router.post("", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
def generate_report_endpoint(
    data: ReportGenerateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    report = generate_report(db, data, generated_by_id=current_member.id)
    report_data = load_report_data(report)
    return ReportDetailResponse(
        id=report.id,
        title=report.title,
        range_type=report.range_type,
        semester=report.semester,
        period_start=report.period_start,
        period_end=report.period_end,
        generated_by_name=report.generated_by.full_name,
        created_at=report.created_at,
        data=report_data,
    )


@router.get("/{report_id}", response_model=ReportDetailResponse)
def get_report_endpoint(
    report_id: int,
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        report = get_report(db, report_id)
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        ) from None

    return ReportDetailResponse(
        id=report.id,
        title=report.title,
        range_type=report.range_type,
        semester=report.semester,
        period_start=report.period_start,
        period_end=report.period_end,
        generated_by_name=report.generated_by.full_name,
        created_at=report.created_at,
        data=load_report_data(report),
    )


@router.get("/{report_id}/pdf")
def download_report_pdf_endpoint(
    report_id: int,
    _: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        report = get_report(db, report_id)
    except ReportNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        ) from None

    data = load_report_data(report)
    pdf_bytes = generate_report_pdf(data)
    filename = f"nsa-connect-report-{report.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
