from pydantic import BaseModel, Field


class ConstitutionChunkResponse(BaseModel):
    id: int = Field(ge=1)
    chunk_index: int = Field(ge=0)
    section: str | None = None
    content: str = Field(min_length=1)
    token_count: int = Field(ge=1)


class ConstitutionPdfExtractResponse(BaseModel):
    filename: str | None = None
    page_count: int = Field(ge=1)
    char_count: int = Field(ge=1)
    chunk_size_tokens: int = Field(ge=1)
    overlap_tokens: int = Field(ge=0)
    chunk_count: int = Field(ge=1)
    chunks: list[ConstitutionChunkResponse]


class ConstitutionSearchRequest(BaseModel):
    query: str = Field(
        min_length=1,
        max_length=2000,
        description="Natural-language question to search against the constitution",
    )
    limit: int | None = Field(
        default=None,
        ge=1,
        le=20,
        description="Maximum number of matching chunks to return",
    )


class ConstitutionSearchResult(BaseModel):
    id: int = Field(ge=1)
    chunk_index: int = Field(ge=0)
    section: str | None = None
    content: str = Field(min_length=1)
    similarity_score: float = Field(ge=0.0, le=1.0)


class ConstitutionSearchResponse(BaseModel):
    query: str
    result_count: int = Field(ge=0)
    results: list[ConstitutionSearchResult]
