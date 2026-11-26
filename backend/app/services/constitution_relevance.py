"""Keep a constitution chunk when cosine similarity or a shared term says it is relevant.

Organization-document retrieval does not use this. The stems are prefixes of
constitutional words, matched at a word boundary so ``vot`` matches ``voting``
and does not match ``devotion``.
"""

from __future__ import annotations

import re

CONSTITUTION_TERM_STEMS: tuple[str, ...] = (
    "amend",
    "ballot",
    "dues",
    "eligib",
    "vot",
    "officer",
)

_STEM_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(rf"\b{re.escape(stem)}", re.IGNORECASE) for stem in CONSTITUTION_TERM_STEMS
)


def _has_stem(pattern: re.Pattern[str], text: str) -> bool:
    return pattern.search(text) is not None


def shares_constitutional_term(question: str, content: str) -> bool:
    """True when the question and chunk share one recognized constitutional stem."""
    return any(
        _has_stem(pattern, question) and _has_stem(pattern, content)
        for pattern in _STEM_PATTERNS
    )


def constitution_chunk_retained(
    *,
    question: str,
    content: str,
    similarity: float,
    minimum: float,
) -> bool:
    """Apply the cosine floor, then the constitutional-term exception."""
    if not content.strip():
        return False
    if similarity >= minimum:
        return True
    return shares_constitutional_term(question, content)
