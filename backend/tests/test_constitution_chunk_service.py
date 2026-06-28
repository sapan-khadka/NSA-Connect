import pytest

from app.services.constitution_chunk_service import (
    ConstitutionChunkingError,
    chunk_constitution_text,
)


def test_short_text_returns_single_chunk():
    text = "Article I. The name of this organization shall be NSA."

    chunks = chunk_constitution_text(
        text,
        chunk_size_tokens=800,
        overlap_tokens=200,
    )

    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].content == text
    assert chunks[0].token_count > 0
    assert chunks[0].section == "Article I. The name of this organization shall be NSA."


def test_long_text_produces_overlapping_chunks():
    import tiktoken

    from app.core.chunking import TIKTOKEN_ENCODING_NAME

    paragraph = (
        "Section 1. Members must maintain good academic standing at SEMO. "
        "They shall participate in association activities throughout the semester."
    )
    text = "Article II. Membership\n\n" + (paragraph + " ") * 80

    chunk_size_tokens = 100
    overlap_tokens = 20
    chunks = chunk_constitution_text(
        text,
        chunk_size_tokens=chunk_size_tokens,
        overlap_tokens=overlap_tokens,
    )

    encoding = tiktoken.get_encoding(TIKTOKEN_ENCODING_NAME)
    all_tokens = encoding.encode(text.strip())

    assert len(chunks) > 1
    assert all(chunk.token_count <= chunk_size_tokens for chunk in chunks)
    assert chunks[0].section == "Article II. Membership"
    assert all(chunk.chunk_index == index for index, chunk in enumerate(chunks))

    stride = chunk_size_tokens - overlap_tokens
    first_overlap = encoding.decode(all_tokens[stride:chunk_size_tokens])
    assert first_overlap in chunks[1].content


def test_overlap_must_be_smaller_than_chunk_size():
    with pytest.raises(
        ConstitutionChunkingError,
        match="overlap_tokens must be smaller than chunk_size_tokens",
    ):
        chunk_constitution_text(
            "Some constitution text.",
            chunk_size_tokens=100,
            overlap_tokens=100,
        )


def test_rejects_empty_text():
    with pytest.raises(ConstitutionChunkingError, match="Text is empty"):
        chunk_constitution_text("   ")


def test_zero_overlap_produces_non_overlapping_windows():
    words = "word " * 300
    text = f"Article III. Duties\n\n{words}"

    chunks = chunk_constitution_text(
        text,
        chunk_size_tokens=50,
        overlap_tokens=0,
    )

    assert len(chunks) > 1
    assert chunks[0].content[-20:] not in chunks[1].content[:20]


def test_default_overlap_is_two_hundred_tokens():
    from app.core.chunking import DEFAULT_CHUNK_OVERLAP_TOKENS

    assert DEFAULT_CHUNK_OVERLAP_TOKENS == 200
