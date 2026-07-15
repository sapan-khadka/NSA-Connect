from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.member_document import MemberDocumentType


class MemberDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    uploaded_by_id: int
    uploaded_by_name: str
    file_url: str
    file_name: str
    document_type: MemberDocumentType
    uploaded_at: datetime
    can_delete: bool = True


class MemberDocumentListResponse(BaseModel):
    member_id: int
    documents: list[MemberDocumentResponse]
    total: int


class MemberDocumentCreateMeta(BaseModel):
    """Form fields accompanying the multipart file upload."""

    document_type: MemberDocumentType = Field(..., description="Document category")
    file_name: str | None = Field(
        default=None,
        max_length=512,
        description="Optional display name; defaults to the uploaded filename",
    )
