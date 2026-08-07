from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.core.safe_messages import (
    GENERIC_EMBEDDING_UNAVAILABLE,
    GENERIC_PDF_PROCESSING_ERROR,
)
from app.models.member import Member
from app.schemas.org_document import (
    OrgDocumentListResponse,
    OrgDocumentResponse,
    OrgDocumentUpdateRequest,
)
from app.services.embedding_service import (
    EmbeddingGenerationError,
    EmbeddingsNotConfiguredError,
)
from app.services.org_document_service import (
    OrgDocumentForbiddenError,
    OrgDocumentNotFoundError,
    OrgDocumentValidationError,
    create_org_document,
    delete_org_document,
    get_org_document,
    list_org_documents,
    update_org_document,
)

router = APIRouter(prefix="/org-documents", tags=["org-documents"])


def _handle_errors(exc: Exception) -> None:
    if isinstance(exc, OrgDocumentNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from exc
    if isinstance(exc, OrgDocumentForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        ) from exc
    if isinstance(exc, OrgDocumentValidationError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    if isinstance(exc, EmbeddingsNotConfiguredError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document search indexing is not configured",
        ) from exc
    if isinstance(exc, EmbeddingGenerationError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=GENERIC_EMBEDDING_UNAVAILABLE,
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=GENERIC_PDF_PROCESSING_ERROR,
    ) from exc


@router.get("", response_model=OrgDocumentListResponse)
def list_org_documents_endpoint(
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    documents = list_org_documents(db, member=current_member)
    return OrgDocumentListResponse(documents=documents)


@router.get("/{document_id}", response_model=OrgDocumentResponse)
def get_org_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member),
):
    try:
        doc = get_org_document(db, member=current_member, document_id=document_id)
    except (OrgDocumentNotFoundError, OrgDocumentForbiddenError) as exc:
        _handle_errors(exc)
    return OrgDocumentResponse(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        visibility=doc.visibility,  # type: ignore[arg-type]
        file_name=doc.file_name,
        file_url=doc.file_url,
        content_type=doc.content_type,
        page_count=doc.page_count,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        uploaded_by_id=doc.uploaded_by_id,
        uploaded_by_name=(
            doc.uploaded_by.full_name if doc.uploaded_by is not None else None
        ),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.post(
    "",
    response_model=OrgDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_org_document_endpoint(
    title: str = Form(...),
    visibility: str = Form(default="public"),
    description: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    file_bytes = await file.read()
    try:
        return create_org_document(
            db,
            actor=current_member,
            title=title,
            description=description,
            visibility=visibility,
            file_bytes=file_bytes,
            content_type=file.content_type,
            filename=file.filename,
        )
    except Exception as exc:
        if isinstance(
            exc,
            (
                OrgDocumentForbiddenError,
                OrgDocumentValidationError,
                EmbeddingsNotConfiguredError,
                EmbeddingGenerationError,
            ),
        ):
            _handle_errors(exc)
        _handle_errors(exc)


@router.patch("/{document_id}", response_model=OrgDocumentResponse)
def update_org_document_endpoint(
    document_id: int,
    payload: OrgDocumentUpdateRequest,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    try:
        return update_org_document(
            db,
            actor=current_member,
            document_id=document_id,
            title=payload.title,
            description=payload.description,
            visibility=payload.visibility,
        )
    except (
        OrgDocumentNotFoundError,
        OrgDocumentForbiddenError,
        OrgDocumentValidationError,
    ) as exc:
        _handle_errors(exc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    current_member: Member = Depends(require_board),
):
    try:
        delete_org_document(db, actor=current_member, document_id=document_id)
    except (OrgDocumentNotFoundError, OrgDocumentForbiddenError) as exc:
        _handle_errors(exc)
