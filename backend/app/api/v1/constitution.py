from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_member, require_board
from app.models.member import Member
from app.schemas.constitution import (
    ConstitutionChunkResponse,
    ConstitutionPdfExtractResponse,
    ConstitutionSearchRequest,
    ConstitutionSearchResponse,
    ConstitutionSearchResult,
)
from app.services.constitution_chunk_service import ConstitutionChunkingError
from app.services.constitution_ingest_service import ingest_constitution_pdf
from app.services.constitution_pdf_service import (
    ConstitutionPdfExtractionError,
    ConstitutionPdfValidationError,
)
from app.services.constitution_search_service import search_constitution_chunks
from app.services.embedding_service import (
    EmbeddingGenerationError,
    EmbeddingsNotConfiguredError,
)

router = APIRouter(prefix="/constitution", tags=["constitution"])


@router.post(
    "/upload",
    response_model=ConstitutionPdfExtractResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_constitution_pdf_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Member = Depends(require_board),
) -> ConstitutionPdfExtractResponse:
    file_bytes = await file.read()

    try:
        result = ingest_constitution_pdf(
            db,
            file_bytes=file_bytes,
            content_type=file.content_type,
            filename=file.filename,
        )
    except ConstitutionPdfValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except (
        ConstitutionPdfExtractionError,
        ConstitutionChunkingError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except EmbeddingsNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding generation is not configured",
        ) from None
    except EmbeddingGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None

    return ConstitutionPdfExtractResponse(
        filename=result.filename,
        page_count=result.page_count,
        char_count=result.char_count,
        chunk_size_tokens=result.chunk_size_tokens,
        overlap_tokens=result.overlap_tokens,
        chunk_count=len(result.chunks),
        chunks=[
            ConstitutionChunkResponse(
                id=chunk.id,
                chunk_index=chunk.chunk_index,
                section=chunk.section,
                content=chunk.content,
                token_count=chunk.token_count,
            )
            for chunk in result.chunks
        ],
    )


@router.post(
    "/search",
    response_model=ConstitutionSearchResponse,
    status_code=status.HTTP_200_OK,
)
def search_constitution_endpoint(
    data: ConstitutionSearchRequest,
    db: Session = Depends(get_db),
    _: Member = Depends(get_current_member),
) -> ConstitutionSearchResponse:
    try:
        hits = search_constitution_chunks(
            db,
            query=data.query,
            limit=data.limit,
        )
    except EmbeddingsNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding generation is not configured",
        ) from None
    except EmbeddingGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from None

    return ConstitutionSearchResponse(
        query=data.query.strip(),
        result_count=len(hits),
        results=[
            ConstitutionSearchResult(
                id=hit.id,
                chunk_index=hit.chunk_index,
                section=hit.section,
                content=hit.content,
                similarity_score=round(hit.similarity_score, 6),
            )
            for hit in hits
        ],
    )
