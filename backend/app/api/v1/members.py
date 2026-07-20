import math
from datetime import UTC, datetime
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board, require_president
from app.core.password_validation import WeakPasswordError
from app.core.rate_limit import change_password_key, limit
from app.core.security import create_token_pair
from app.integrations.cloudinary_client import CloudinaryUploadError
from app.lib.member_talents import ALL_MEMBER_TALENTS, MEMBER_TALENT_LABELS
from app.lib.semester import get_current_semester_slug
from app.models.member import Member, MemberRole, MemberStatus
from app.services.member_engagement_service import (
    DEFAULT_ENGAGEMENT_WINDOW_DAYS,
    build_members_engagement,
)
from app.models.member_document import MemberDocumentType
from app.schemas.auth import TokenResponse
from app.schemas.custom_board_position import MemberPositionUpdateRequest
from app.schemas.member import (
    MemberBoardRoleUpdateRequest,
    MemberImportResponse,
    MemberInviteRequest,
    MemberInviteResponse,
    MemberListResponse,
    MemberPasswordChangeRequest,
    MemberProfileUpdateRequest,
    MemberResponse,
    MemberTalentOptionsResponse,
    PaginatedMemberListResponse,
)
from app.schemas.member_activity import MemberActivityListResponse
from app.schemas.member_document import (
    MemberDocumentListResponse,
    MemberDocumentResponse,
)
from app.schemas.member_engagement import MembersEngagementResponse
from app.schemas.member_insights import MemberMeetingAttendanceStreakResponse
from app.schemas.member_note import (
    MemberNoteCreateRequest,
    MemberNoteListResponse,
    MemberNoteResponse,
    MemberNoteUpdateRequest,
)
from app.services.member_activity_service import get_member_activity
from app.services.member_document_service import (
    MemberDocumentNotFoundError,
    MemberDocumentPermissionError,
    create_member_document,
    delete_member_document,
    list_member_documents,
    replace_member_document,
)
from app.services.member_note_service import (
    MemberNoteNotFoundError,
    MemberNotePermissionError,
    create_member_note,
    delete_member_note,
    list_member_notes,
    update_member_note,
)
from app.services.member_meeting_streak_service import (
    MemberMeetingStreakPermissionError,
    get_member_consecutive_missed_meetings,
)
from app.services.member_import_service import import_members_csv
from app.services.custom_board_position_service import (
    CustomBoardPositionConflictError,
    CustomBoardPositionNotFoundError,
    CustomBoardPositionValidationError,
)
from app.services.member_service import (
    InvalidCurrentPasswordError,
    InvalidMemberRoleError,
    InvalidMemberStatusError,
    MemberAlreadyExistsError,
    MemberNotFoundError,
    StudentIdAlreadyExistsError,
    approve_member,
    assign_member_position,
    build_members_export_csv,
    change_member_password,
    create_invited_member,
    get_member_by_id,
    list_assignable_approved_members,
    list_assignable_board_members,
    list_members_by_status,
    list_members_paginated,
    reject_member,
    update_member_board_role,
    update_member_profile,
)
from app.services.password_reset_service import send_initial_password_setup
from app.services.receipt_upload_service import (
    ReceiptUploadUnavailableError,
    ReceiptValidationError,
)
from app.tasks.email_tasks import send_welcome_email_task

router = APIRouter(prefix="/members", tags=["members"])


def _member_response(member: Member, viewer: Member) -> MemberResponse:
    return MemberResponse.from_member(member, viewer=viewer)


@router.get("/talent-options", response_model=MemberTalentOptionsResponse)
def list_talent_options(
    _: Member = Depends(get_current_member),
):
    return MemberTalentOptionsResponse(
        talents=[talent.value for talent in ALL_MEMBER_TALENTS],
        labels={talent.value: label for talent, label in MEMBER_TALENT_LABELS.items()},
    )


@router.get("", response_model=PaginatedMemberListResponse)
def list_members(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: MemberStatus | None = None,
    talents: list[str] | None = Query(default=None),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    if status is not None and not current_member.has_role_at_least(MemberRole.BOARD):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only board members can filter by status",
        )

    effective_status = status
    if effective_status is None and not current_member.has_role_at_least(
        MemberRole.BOARD
    ):
        effective_status = MemberStatus.APPROVED

    members, total = list_members_paginated(
        db,
        page=page,
        page_size=page_size,
        status=effective_status,
        talents=talents,
    )
    total_pages = math.ceil(total / page_size) if total else 0
    return PaginatedMemberListResponse(
        members=[_member_response(member, current_member) for member in members],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/me", response_model=MemberResponse)
def get_my_profile(current_member: Member = Depends(get_current_member)):
    return MemberResponse.from_member(current_member, viewer=current_member)


@router.patch("/me", response_model=MemberResponse)
def update_my_profile(
    data: MemberProfileUpdateRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        member = update_member_profile(db, current_member.id, data)
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.post("/me/password", response_model=TokenResponse)
@limit(
    f"{settings.RATE_LIMIT_CHANGE_PASSWORD_MAX}/{settings.RATE_LIMIT_CHANGE_PASSWORD_WINDOW_SECONDS}second",
    key_func=change_password_key,
)
def change_my_password(
    request: Request,
    data: MemberPasswordChangeRequest,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        change_member_password(
            db,
            current_member.id,
            current_password=data.current_password,
            new_password=data.new_password,
        )
    except InvalidCurrentPasswordError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        ) from None
    except WeakPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    member = get_member_by_id(db, current_member.id)
    (
        access_token,
        expires_at,
        refresh_token,
        refresh_expires_at,
    ) = create_token_pair(
        member_id=member.id,
        email=member.email,
        role=member.role.value,
        token_version=member.token_version,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        refresh_expires_at=refresh_expires_at,
    )


@router.get("/assignees", response_model=MemberListResponse)
def list_assignable_members(
    scope: Literal["board", "all_approved"] = Query(default="board"),
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = (
        list_assignable_approved_members(db)
        if scope == "all_approved"
        else list_assignable_board_members(db)
    )
    return MemberListResponse(
        members=[
            MemberResponse.from_member(member, viewer=current_member)
            for member in members
        ],
        total=len(members),
    )


@router.get("/pending", response_model=MemberListResponse)
def list_pending_members(
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    members = list_members_by_status(db, MemberStatus.PENDING)
    return MemberListResponse(
        members=[
            MemberResponse.from_member(member, viewer=current_member)
            for member in members
        ],
        total=len(members),
    )


@router.get("/engagement", response_model=MembersEngagementResponse)
def get_members_engagement(
    window_days: int = Query(
        DEFAULT_ENGAGEMENT_WINDOW_DAYS,
        ge=7,
        le=365,
        description="Activity lookback window in days for check-ins, tasks, and suggestions.",
    ),
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    """
    Activity-based active vs idle for approved members.

    Active signals: recent event attendance, paid/exempt dues this semester,
    completed or in-progress tasks, or a recent event suggestion.
    """
    return build_members_engagement(db, window_days=window_days)


@router.get("/export")
def export_members_csv(
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    """Download all members as CSV (directory columns + current-semester dues)."""
    semester = get_current_semester_slug()
    csv_text = build_members_export_csv(db, semester=semester)
    stamp = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"nsa-members-{stamp}.csv"
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/invite",
    response_model=MemberInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_member(
    data: MemberInviteRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = create_invited_member(db, data)
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None
    except StudentIdAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student ID already registered",
        ) from None

    setup_email_sent = send_initial_password_setup(db, member)
    return MemberInviteResponse(
        member=MemberResponse.from_member(member, viewer=current_member),
        setup_email_sent=setup_email_sent,
    )


@router.post("/import", response_model=MemberImportResponse)
async def import_members(
    file: UploadFile = File(...),
    _: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Upload must be a CSV file",
        )
    return import_members_csv(db, await file.read())


@router.patch("/{member_id}/approve", response_model=MemberResponse)
def approve_member_endpoint(
    member_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = approve_member(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    send_welcome_email_task.delay(
        email=member.email,
        full_name=member.full_name,
    )

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/reject", response_model=MemberResponse)
def reject_member_endpoint(
    member_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = reject_member(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}", response_model=MemberResponse)
def update_member_profile_endpoint(
    member_id: int,
    data: MemberProfileUpdateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        member = update_member_profile(db, member_id, data)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/role", response_model=MemberResponse)
def update_member_role_endpoint(
    member_id: int,
    data: MemberBoardRoleUpdateRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    if member_id == current_member.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    try:
        member = update_member_board_role(db, member_id, data.role)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except InvalidMemberRoleError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    return MemberResponse.from_member(member, viewer=current_member)


@router.patch("/{member_id}/position", response_model=MemberResponse)
def update_member_position_endpoint(
    member_id: int,
    data: MemberPositionUpdateRequest,
    current_member: Member = Depends(require_president),
    db: Session = Depends(get_db),
):
    try:
        member = assign_member_position(
            db,
            member_id,
            kind=data.kind,
            position=data.position,
            custom_board_position_id=data.custom_board_position_id,
        )
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except CustomBoardPositionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom board position not found",
        ) from None
    except InvalidMemberRoleError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
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

    return MemberResponse.from_member(member, viewer=current_member)


@router.get("/{member_id}/activity", response_model=MemberActivityListResponse)
def get_member_activity_endpoint(
    member_id: int,
    limit: int = Query(50, ge=1, le=100),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """
    Reverse-chronological activity for a member from real timestamped sources
    (completed tasks, dues payments, event check-ins). Item visibility follows
    the same access rules as each underlying data source.
    """
    try:
        subject = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None

    if subject.status != MemberStatus.APPROVED and not current_member.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return get_member_activity(
        db,
        member_id=member_id,
        viewer=current_member,
        limit=limit,
    )


@router.get(
    "/{member_id}/meeting-attendance-streak",
    response_model=MemberMeetingAttendanceStreakResponse,
)
def get_member_meeting_attendance_streak_endpoint(
    member_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """
    Trailing consecutive ABSENT marks on past meeting roll calls.

    Used by deterministic Member Workspace insights (not generative AI).
    Access: self or board+.
    """
    try:
        return get_member_consecutive_missed_meetings(
            db,
            member_id=member_id,
            viewer=current_member,
        )
    except MemberMeetingStreakPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view this meeting attendance streak",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None


@router.get(
    "/{member_id}/documents",
    response_model=MemberDocumentListResponse,
)
def list_member_documents_endpoint(
    member_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """
    List documents for one member.

    Access: self (own member_id only) or board+ (any member). GET always scopes
    to the path member_id — never returns other members' files.
    """
    try:
        return list_member_documents(
            db,
            member_id=member_id,
            viewer=current_member,
        )
    except MemberDocumentPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view these documents",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None


@router.post(
    "/{member_id}/documents",
    response_model=MemberDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_member_document_endpoint(
    member_id: int,
    file: UploadFile = File(...),
    document_type: MemberDocumentType = Form(...),
    file_name: str | None = Form(default=None),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """Upload a member document (PDF/JPEG/PNG/WebP) via existing Cloudinary storage."""
    file_bytes = await file.read()
    display_name = (file_name or file.filename or "document").strip()

    try:
        return create_member_document(
            db,
            member_id=member_id,
            uploaded_by=current_member,
            file_bytes=file_bytes,
            content_type=file.content_type,
            file_name=display_name,
            document_type=document_type,
        )
    except MemberDocumentPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to upload documents for this member",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except ReceiptValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except ReceiptUploadUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document upload is not configured",
        ) from exc
    except CloudinaryUploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload document",
        ) from exc


@router.put(
    "/{member_id}/documents/{document_id}",
    response_model=MemberDocumentResponse,
)
async def replace_member_document_endpoint(
    member_id: int,
    document_id: int,
    file: UploadFile = File(...),
    document_type: MemberDocumentType | None = Form(default=None),
    file_name: str | None = Form(default=None),
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    """Replace an existing document file (same id), keeping ownership on member_id."""
    file_bytes = await file.read()
    display_name = file_name
    if display_name is None and file.filename:
        display_name = file.filename

    try:
        return replace_member_document(
            db,
            member_id=member_id,
            document_id=document_id,
            viewer=current_member,
            file_bytes=file_bytes,
            content_type=file.content_type,
            file_name=display_name,
            document_type=document_type,
        )
    except MemberDocumentPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to replace documents for this member",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberDocumentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from None
    except ReceiptValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except ReceiptUploadUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document upload is not configured",
        ) from exc
    except CloudinaryUploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload document",
        ) from exc


@router.delete(
    "/{member_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_member_document_endpoint(
    member_id: int,
    document_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        delete_member_document(
            db,
            member_id=member_id,
            document_id=document_id,
            viewer=current_member,
        )
    except MemberDocumentPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete documents for this member",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberDocumentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from None


@router.get(
    "/{member_id}/notes",
    response_model=MemberNoteListResponse,
)
def list_member_notes_endpoint(
    member_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    """Private officer notes. Board+ only — never exposed to the subject member."""
    try:
        return list_member_notes(
            db,
            member_id=member_id,
            viewer=current_member,
        )
    except MemberNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view private notes",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None


@router.post(
    "/{member_id}/notes",
    response_model=MemberNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_member_note_endpoint(
    member_id: int,
    body: MemberNoteCreateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return create_member_note(
            db,
            member_id=member_id,
            author=current_member,
            content=body.content,
            pinned=body.pinned,
        )
    except MemberNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to create private notes",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None


@router.patch(
    "/{member_id}/notes/{note_id}",
    response_model=MemberNoteResponse,
)
def update_member_note_endpoint(
    member_id: int,
    note_id: int,
    body: MemberNoteUpdateRequest,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        return update_member_note(
            db,
            member_id=member_id,
            note_id=note_id,
            viewer=current_member,
            content=body.content,
            pinned=body.pinned,
        )
    except MemberNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update private notes",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        ) from None


@router.delete(
    "/{member_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_member_note_endpoint(
    member_id: int,
    note_id: int,
    current_member: Member = Depends(require_board),
    db: Session = Depends(get_db),
):
    try:
        delete_member_note(
            db,
            member_id=member_id,
            note_id=note_id,
            viewer=current_member,
        )
    except MemberNotePermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete private notes",
        ) from None
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None
    except MemberNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        ) from None


@router.get("/{member_id}", response_model=MemberResponse)
def get_member_endpoint(
    member_id: int,
    current_member: Member = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    try:
        member = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        ) from None

    if member.status != MemberStatus.APPROVED and not current_member.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return MemberResponse.from_member(member, viewer=current_member)
