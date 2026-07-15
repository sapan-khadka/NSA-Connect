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


def _display_name(member: Member | None) -> str:
    if member is None:
        return "Unknown"
    return member.full_name or member.email


def _to_response(document: MemberDocument, *, can_delete: bool) -> MemberDocumentResponse:
    return MemberDocumentResponse(
        id=document.id,
        member_id=document.member_id,
        uploaded_by_id=document.uploaded_by_id,
        uploaded_by_name=_display_name(document.uploaded_by),
        file_url=document.file_url,
        file_name=document.file_name,
        document_type=document.document_type,
        uploaded_at=document.uploaded_at,
        can_delete=can_delete,
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


def list_member_documents(
    db: Session,
    *,
    member_id: int,
    viewer: Member,
) -> MemberDocumentListResponse:
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

    documents = [_to_response(row, can_delete=True) for row in rows]
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
    return _to_response(document, can_delete=True)


def delete_member_document(
    db: Session,
    *,
    member_id: int,
    document_id: int,
    viewer: Member,
) -> None:
    ensure_member_accessible(db, member_id, viewer)

    document = db.scalar(
        select(MemberDocument).where(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id,
        ),
    )
    if document is None:
        raise MemberDocumentNotFoundError

    if (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        try:
            delete_cloudinary_asset(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                public_id=document.public_id,
                resource_type=document.resource_type or "image",
            )
        except CloudinaryUploadError:
            pass

    db.delete(document)
    db.commit()


__all__ = [
    "MemberDocumentNotFoundError",
    "ReceiptUploadUnavailableError",
    "create_member_document",
    "delete_member_document",
    "list_member_documents",
]
