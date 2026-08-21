"""Streaming upload size guard to prevent memory-exhaustion attacks."""

from fastapi import HTTPException, UploadFile, status

DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB (largest allowed: video)


async def read_upload_with_limit(
    file: UploadFile,
    *,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> bytes:
    """Read an UploadFile in chunks, raising 413 if the stream exceeds *max_bytes*.

    This prevents an attacker from sending a multi-GB body that is fully
    buffered in memory before any validation runs.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(256 * 1024)  # 256 KB per read
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload exceeds {max_bytes // (1024 * 1024)} MB limit",
            )
        chunks.append(chunk)
    return b"".join(chunks)
