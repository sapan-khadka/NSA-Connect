from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_treasurer
from app.models.member import Member
from app.schemas.finance import FinanceEntryCreateRequest, FinanceEntryResponse
from app.services.finance_service import create_finance_entry

router = APIRouter(prefix="/finance", tags=["finance"])

TREASURER_REQUIRED_DETAIL = "Requires treasurer role or higher"


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
    entry = create_finance_entry(db, data, created_by=current_member)
    return FinanceEntryResponse.from_entry(entry)
