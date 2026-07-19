from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_president
from app.models.member import Member
from app.schemas.custom_board_position import (
    CustomBoardPositionCreateRequest,
    CustomBoardPositionListResponse,
    CustomBoardPositionRenameRequest,
    CustomBoardPositionResponse,
    MemberPositionCatalogResponse,
)
from app.services.custom_board_position_service import (
    CustomBoardPositionConflictError,
    CustomBoardPositionNotFoundError,
    CustomBoardPositionValidationError,
    archive_custom_board_position,
    create_custom_board_position,
    get_member_position_catalog,
    list_custom_position_responses,
    rename_custom_board_position,
    to_custom_board_position_response,
)

router = APIRouter(prefix="/member-positions", tags=["member-positions"])


@router.get("", response_model=MemberPositionCatalogResponse)
def list_member_positions_catalog(
    include_archived: bool = Query(False),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    del current_member
    return get_member_position_catalog(db, include_archived=include_archived)


@router.get("/custom", response_model=CustomBoardPositionListResponse)
def list_custom_positions(
    include_archived: bool = Query(False),
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    del current_member
    positions = list_custom_position_responses(
        db,
        include_archived=include_archived,
    )
    return CustomBoardPositionListResponse(positions=positions, total=len(positions))


@router.post(
    "/custom",
    response_model=CustomBoardPositionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_custom_position(
    data: CustomBoardPositionCreateRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    try:
        position = create_custom_board_position(
            db,
            name=data.name,
            created_by=current_member,
        )
    except CustomBoardPositionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
    except CustomBoardPositionConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from None
    return to_custom_board_position_response(position)


@router.patch("/custom/{position_id}", response_model=CustomBoardPositionResponse)
def rename_custom_position(
    position_id: int,
    data: CustomBoardPositionRenameRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    del current_member
    try:
        position = rename_custom_board_position(db, position_id, name=data.name)
    except CustomBoardPositionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom board position not found",
        ) from None
    except CustomBoardPositionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
    except CustomBoardPositionConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from None
    return to_custom_board_position_response(position)


@router.post(
    "/custom/{position_id}/archive",
    response_model=CustomBoardPositionResponse,
)
def archive_custom_position(
    position_id: int,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    del current_member
    try:
        position = archive_custom_board_position(db, position_id)
    except CustomBoardPositionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom board position not found",
        ) from None
    return to_custom_board_position_response(position)
