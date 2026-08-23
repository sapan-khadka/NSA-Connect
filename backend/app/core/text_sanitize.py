"""Plain-text sanitization before persistence or model prompts."""

from __future__ import annotations

import re
from html import unescape

# Strip HTML-ish tags; keep plain text for chat/notes/titles.
_TAG_RE = re.compile(r"</?[^>\n]{0,200}>")
# C0 controls except tab/newline/CR, plus DEL and common bidi overrides.
_UNSAFE_CHARS_RE = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]"
)


def sanitize_plain_text(
    value: str,
    *,
    max_length: int | None = None,
    allow_newlines: bool = True,
) -> str:
    """Normalize untrusted text: unescape entities, drop tags/controls, trim."""
    text = unescape(value)
    text = _TAG_RE.sub("", text)
    text = _UNSAFE_CHARS_RE.sub("", text)
    if not allow_newlines:
        text = " ".join(text.split())
    else:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = "\n".join(line.rstrip() for line in text.split("\n"))
        text = text.strip()
    if max_length is not None and len(text) > max_length:
        text = text[:max_length]
    return text
