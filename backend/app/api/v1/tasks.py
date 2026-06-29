from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member
from app.models.member import Member
from app.schemas.preptask import (
    PrepTaskChecklistItemUpdateRequest,
    PrepTaskResponse,
    PrepTaskUpdateRequest,
)
from app.services.event_task_service import (
    EventTaskChecklistItemNotFoundError,
    EventTaskForbiddenError,
    EventTaskNotFoundError,
    InvalidEventTaskAssigneeError,
    update_event_task,
    update_event_task_checklist_item,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.patch("/{task_id}", response_model=PrepTaskResponse)
def update_prep_task_endpoint(
    task_id: int,
    data: PrepTaskUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    from app.schemas.event_task import EventTaskUpdateRequest

    try:
        task = update_event_task(
            db,
            task_id,
            EventTaskUpdateRequest(**data.model_dump(exclude_unset=True)),
            current_member,
        )
    except EventTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prep task not found",
        ) from None
    except EventTaskForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this prep task",
        ) from None
    except InvalidEventTaskAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must be an approved board member",
        ) from None

    return PrepTaskResponse.from_event_task(task)


@router.patch(
    "/{task_id}/checklist-items/{item_id}",
    response_model=PrepTaskResponse,
)
def update_prep_task_checklist_item_endpoint(
    task_id: int,
    item_id: int,
    data: PrepTaskChecklistItemUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        task = update_event_task_checklist_item(
            db,
            task_id,
            item_id,
            is_completed=data.is_completed,
            current_member=current_member,
        )
    except EventTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prep task not found",
        ) from None
    except EventTaskChecklistItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist item not found",
        ) from None
    except EventTaskForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this prep task",
        ) from None

    return PrepTaskResponse.from_event_task(task)
