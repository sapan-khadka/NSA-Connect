from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OrgDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    visibility: Literal["public", "board"]
    file_name: str
    file_url: str | None
    content_type: str | None
    page_count: int | None
    char_count: int | None
    chunk_count: int
    uploaded_by_id: int | None
    uploaded_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class OrgDocumentListResponse(BaseModel):
    documents: list[OrgDocumentResponse]


class OrgDocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    visibility: Literal["public", "board"] | None = None
