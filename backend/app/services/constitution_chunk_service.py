import re
from dataclasses import dataclass
from functools import lru_cache

import tiktoken

from app.core.chunking import (
    DEFAULT_CHUNK_OVERLAP_TOKENS,
    DEFAULT_CHUNK_SIZE_TOKENS,
    TIKTOKEN_ENCODING_NAME,
)

SECTION_HEADER_PATTERN = re.compile(
    r"^(?:Article|ARTICLE|Section|SECTION)\s+[IVXLC\d]+(?:[.:]\s*[^\n]*)?",
    re.MULTILINE,
)


class ConstitutionChunkingError(Exception):
    pass


@dataclass(frozen=True)
class ConstitutionTextChunk:
    chunk_index: int
    content: str
    token_count: int
    section: str | None = None


@lru_cache
def _get_token_encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding(TIKTOKEN_ENCODING_NAME)


def _validate_chunk_settings(*, chunk_size_tokens: int, overlap_tokens: int) -> None:
    if chunk_size_tokens <= 0:
        raise ConstitutionChunkingError("chunk_size_tokens must be greater than 0")

    if overlap_tokens < 0:
        raise ConstitutionChunkingError("overlap_tokens must be zero or greater")

    if overlap_tokens >= chunk_size_tokens:
        raise ConstitutionChunkingError(
            "overlap_tokens must be smaller than chunk_size_tokens"
        )


def _section_for_char_position(text: str, char_position: int) -> str | None:
    section: str | None = None
    for match in SECTION_HEADER_PATTERN.finditer(text):
        if match.start() <= char_position:
            section = match.group(0).strip()
        else:
            break
    return section


def chunk_constitution_text(
    text: str,
    *,
    chunk_size_tokens: int = DEFAULT_CHUNK_SIZE_TOKENS,
    overlap_tokens: int = DEFAULT_CHUNK_OVERLAP_TOKENS,
) -> list[ConstitutionTextChunk]:
    """Split constitution text into overlapping token windows for retrieval."""
    normalized = text.strip()
    if not normalized:
        raise ConstitutionChunkingError("Text is empty")

    _validate_chunk_settings(
        chunk_size_tokens=chunk_size_tokens,
        overlap_tokens=overlap_tokens,
    )

    encoding = _get_token_encoding()
    tokens = encoding.encode(normalized)
    if not tokens:
        raise ConstitutionChunkingError("Text produced no tokens")

    if len(tokens) <= chunk_size_tokens:
        return [
            ConstitutionTextChunk(
                chunk_index=0,
                content=normalized,
                token_count=len(tokens),
                section=_section_for_char_position(normalized, 0),
            )
        ]

    chunks: list[ConstitutionTextChunk] = []
    stride = chunk_size_tokens - overlap_tokens
    start = 0
    chunk_index = 0

    while start < len(tokens):
        end = min(start + chunk_size_tokens, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens).strip()
        if chunk_text:
            char_start = len(encoding.decode(tokens[:start]))
            chunks.append(
                ConstitutionTextChunk(
                    chunk_index=chunk_index,
                    content=chunk_text,
                    token_count=len(chunk_tokens),
                    section=_section_for_char_position(normalized, char_start),
                )
            )
            chunk_index += 1

        if end >= len(tokens):
            break

        start += stride

    if not chunks:
        raise ConstitutionChunkingError("No chunks were produced from text")

    return chunks
