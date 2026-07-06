from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_member,
    require_board,
    require_task_manager,
    require_task_oversight,
)
from app.models.member import Member
from app.schemas.event_task import (
    EventTaskChecklistItemUpdateRequest,
    EventTaskCreateRequest,
    EventTaskListResponse,
    EventTaskResponse,
    EventTaskUpdateRequest,
    TaskOverviewResponse,
    TaskPhotoUploadResponse,
)
from app.services.event_service import EventNotFoundError
from app.services.event_task_service import (
    EventTaskChecklistItemNotFoundError,
    EventTaskCreationClosedError,
    EventTaskForbiddenError,
    EventTaskNotFoundError,
    InvalidEventTaskAssigneeError,
    create_simple_event_task,
    delete_event_task,
    get_task_overview,
    list_event_tasks_for_event,
    list_my_event_tasks,
    update_event_task,
    update_event_task_checklist_item,
)
from app.services.receipt_upload_service import (
    ReceiptUploadUnavailableError,
    ReceiptValidationError,
    upload_task_photo,
)

router = APIRouter(tags=["event-tasks"])


@router.post(
    "/events/{event_id}/event-tasks",
    response_model=EventTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_task_endpoint(
    event_id: int,
    data: EventTaskCreateRequest,
    current_member: Member = Depends(require_task_manager),
    db: Session = Depends(get_db),
):
    try:
        task = create_simple_event_task(db, event_id, data, created_by=current_member)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None
    except InvalidEventTaskAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee must be an approved board member",
        ) from None
    except EventTaskCreationClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This event has ended. New tasks can no longer be added.",
        ) from None

    return EventTaskResponse.from_task(task)


@router.get(
    "/events/{event_id}/event-tasks",
    response_model=EventTaskListResponse,
)
def list_event_tasks_endpoint(
    event_id: int,
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        tasks = list_event_tasks_for_event(db, event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        ) from None

    return EventTaskListResponse(
        tasks=[EventTaskResponse.from_task(task) for task in tasks],
        total=len(tasks),
    )


@router.get("/event-tasks/mine", response_model=EventTaskListResponse)
def list_my_event_tasks_endpoint(
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    tasks = list_my_event_tasks(db, current_member.id)
    return EventTaskListResponse(
        tasks=[EventTaskResponse.from_task(task) for task in tasks],
        total=len(tasks),
    )


@router.get("/event-tasks/overview", response_model=TaskOverviewResponse)
def task_overview_endpoint(
    _: Member = Depends(require_task_oversight),
    db: Session = Depends(get_db),
):
    return get_task_overview(db)


@router.post(
    "/event-tasks/uploads",
    response_model=TaskPhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_task_photo_endpoint(
    file: UploadFile = File(...),
    _: Member = Depends(get_current_member),
):
    file_bytes = await file.read()

    try:
        result = upload_task_photo(
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
            detail="Photo upload is not configured",
        ) from exc

    return TaskPhotoUploadResponse(photo_url=result.receipt_url)


@router.patch("/event-tasks/{task_id}", response_model=EventTaskResponse)
def update_event_task_endpoint(
    task_id: int,
    data: EventTaskUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        task = update_event_task(db, task_id, data, current_member)
    except EventTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        ) from None
    except EventTaskForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify this task",
        ) from None
    except InvalidEventTaskAssigneeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee must be an approved board member",
        ) from None

    return EventTaskResponse.from_task(task)


@router.patch(
    "/event-tasks/{task_id}/checklist-items/{item_id}",
    response_model=EventTaskResponse,
)
def update_event_task_checklist_item_endpoint(
    task_id: int,
    item_id: int,
    data: EventTaskChecklistItemUpdateRequest,
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
            detail="Task not found",
        ) from None
    except EventTaskChecklistItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist item not found",
        ) from None
    except EventTaskForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify this task",
        ) from None

    return EventTaskResponse.from_task(task)


@router.delete("/event-tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_task_endpoint(
    task_id: int,
    _: Member = Depends(require_task_manager),
    db: Session = Depends(get_db),
):
    try:
        delete_event_task(db, task_id)
    except EventTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        ) from None

    return None
