"""Canonical major labels and safe abbreviation aliases.

Only include abbreviation mappings that are unambiguous in this app
(e.g. CS → Computer Science). Do not silently merge ambiguous abbreviations.
"""

from __future__ import annotations

# lowercased input → canonical display label
MAJOR_ALIASES: dict[str, str] = {
    "cs": "Computer Science",
    "c.s.": "Computer Science",
    "c.s": "Computer Science",
    "computer science": "Computer Science",
}


def normalize_major(value: str) -> str:
    """Trim, apply safe aliases, and title-case for consistent storage/display."""
    trimmed = " ".join(value.strip().split())
    if not trimmed:
        return trimmed

    lower = trimmed.lower()
    if lower in MAJOR_ALIASES:
        return MAJOR_ALIASES[lower]

    return " ".join(part.capitalize() for part in lower.split(" "))


def majors_match(left: str, right: str) -> bool:
    return normalize_major(left) == normalize_major(right)
