from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.preptask import PrepTaskResponse, PrepTaskUpdateRequest
from app.services.prep_task_service import (
    InvalidAssigneeError,
    PrepTaskForbiddenError,
    PrepTaskNotFoundError,
    update_prep_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.patch("/{task_id}", response_model=PrepTaskResponse)
def update_prep_task_endpoint(
    task_id: int,
    data: PrepTaskUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        prep_task = update_prep_task(db, task_id, data, current_member)
    except PrepTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prep task not found",
        ) from None
    except PrepTaskForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this prep task",
        ) from None
    except InvalidAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an approved member",
        ) from None

    return PrepTaskResponse.from_prep_task(prep_task)
