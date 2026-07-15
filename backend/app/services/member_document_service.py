from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.integrations.cloudinary_client import (
    CloudinaryUploadError,
    CloudinaryUploadResult,
    delete_cloudinary_asset,
)
from app.models.member import Member, MemberRole, MemberStatus
from app.models.member_document import MemberDocument, MemberDocumentType
from app.schemas.member_document import (
    MemberDocumentListResponse,
    MemberDocumentResponse,
)
from app.services.member_service import MemberNotFoundError, get_member_by_id
from app.services.receipt_upload_service import (
    ReceiptUploadUnavailableError,
    upload_member_document,
)


class MemberDocumentNotFoundError(Exception):
    pass


class MemberDocumentPermissionError(Exception):
    pass


def can_manage_member_documents(viewer: Member, member_id: int) -> bool:
    """
    Self: own documents only.
    Board+ (treasurer/president included): any member's documents.

    Advisor access is intentionally deferred: there is no Advisor role in the
    current model (general | board | treasurer | president). Define Advisor
    document permissions only if/when that role is introduced — do not guess.
    """
    if viewer.id == member_id:
        return True
    return viewer.has_role_at_least(MemberRole.BOARD)


def _display_name(member: Member | None) -> str:
    if member is None:
        return "Unknown"
    return member.full_name or member.email


def _to_response(document: MemberDocument, *, can_manage: bool) -> MemberDocumentResponse:
    return MemberDocumentResponse(
        id=document.id,
        member_id=document.member_id,
        uploaded_by_id=document.uploaded_by_id,
        uploaded_by_name=_display_name(document.uploaded_by),
        file_url=document.file_url,
        file_name=document.file_name,
        document_type=document.document_type,
        uploaded_at=document.uploaded_at,
        can_delete=can_manage,
        can_replace=can_manage,
    )


def ensure_member_accessible(db: Session, member_id: int, viewer: Member) -> Member:
    try:
        subject = get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise

    if subject.status != MemberStatus.APPROVED and not viewer.has_role_at_least(
        MemberRole.BOARD,
    ):
        raise MemberNotFoundError

    return subject


def require_document_access(viewer: Member, member_id: int) -> None:
    if not can_manage_member_documents(viewer, member_id):
        raise MemberDocumentPermissionError


def _delete_cloudinary_asset(
    *,
    public_id: str,
    resource_type: str | None,
) -> None:
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        return
    try:
        delete_cloudinary_asset(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            public_id=public_id,
            resource_type=resource_type or "image",
        )
    except CloudinaryUploadError:
        pass


def list_member_documents(
    db: Session,
    *,
    member_id: int,
    viewer: Member,
) -> MemberDocumentListResponse:
    """List documents for one member_id only — never leaks other members' files."""
    require_document_access(viewer, member_id)
    ensure_member_accessible(db, member_id, viewer)

    rows = (
        db.scalars(
            select(MemberDocument)
            .options(joinedload(MemberDocument.uploaded_by))
            .where(MemberDocument.member_id == member_id)
            .order_by(MemberDocument.uploaded_at.desc(), MemberDocument.id.desc()),
        )
        .unique()
        .all()
    )

    can_manage = True
    documents = [_to_response(row, can_manage=can_manage) for row in rows]
    return MemberDocumentListResponse(
        member_id=member_id,
        documents=documents,
        total=len(documents),
    )


def create_member_document(
    db: Session,
    *,
    member_id: int,
    uploaded_by: Member,
    file_bytes: bytes,
    content_type: str | None,
    file_name: str,
    document_type: MemberDocumentType,
) -> MemberDocumentResponse:
    require_document_access(uploaded_by, member_id)
    ensure_member_accessible(db, member_id, uploaded_by)

    upload_result: CloudinaryUploadResult = upload_member_document(
        file_bytes=file_bytes,
        content_type=content_type,
    )

    document = MemberDocument(
        member_id=member_id,
        uploaded_by_id=uploaded_by.id,
        file_url=upload_result.receipt_url,
        file_name=file_name.strip() or "document",
        document_type=document_type,
        public_id=upload_result.public_id,
        resource_type=upload_result.resource_type or "image",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    document.uploaded_by = uploaded_by
    return _to_response(document, can_manage=True)


def replace_member_document(
    db: Session,
    *,
    member_id: int,
    document_id: int,
    viewer: Member,
    file_bytes: bytes,
    content_type: str | None,
    file_name: str | None,
    document_type: MemberDocumentType | None,
) -> MemberDocumentResponse:
    require_document_access(viewer, member_id)
    ensure_member_accessible(db, member_id, viewer)

    document = db.scalar(
        select(MemberDocument)
        .options(joinedload(MemberDocument.uploaded_by))
        .where(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id,
        ),
    )
    if document is None:
        raise MemberDocumentNotFoundError

    upload_result: CloudinaryUploadResult = upload_member_document(
        file_bytes=file_bytes,
        content_type=content_type,
    )

    old_public_id = document.public_id
    old_resource_type = document.resource_type

    document.file_url = upload_result.receipt_url
    document.public_id = upload_result.public_id
    document.resource_type = upload_result.resource_type or "image"
    document.uploaded_by_id = viewer.id
    document.uploaded_at = datetime.now(UTC)
    if file_name is not None and file_name.strip():
        document.file_name = file_name.strip()
    if document_type is not None:
        document.document_type = document_type

    db.commit()
    db.refresh(document)
    document.uploaded_by = viewer

    # Best-effort cleanup of the previous Cloudinary asset (ignore failures).
    if old_public_id and old_public_id != document.public_id:
        _delete_cloudinary_asset(
            public_id=old_public_id,
            resource_type=old_resource_type,
        )

    return _to_response(document, can_manage=True)


def delete_member_document(
    db: Session,
    *,
    member_id: int,
    document_id: int,
    viewer: Member,
) -> None:
    require_document_access(viewer, member_id)
    ensure_member_accessible(db, member_id, viewer)

    document = db.scalar(
        select(MemberDocument).where(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id,
        ),
    )
    if document is None:
        raise MemberDocumentNotFoundError

    _delete_cloudinary_asset(
        public_id=document.public_id,
        resource_type=document.resource_type,
    )
    db.delete(document)
    db.commit()


__all__ = [
    "MemberDocumentNotFoundError",
    "MemberDocumentPermissionError",
    "ReceiptUploadUnavailableError",
    "can_manage_member_documents",
    "create_member_document",
    "delete_member_document",
    "list_member_documents",
    "replace_member_document",
]
