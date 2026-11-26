"""Keep AI minutes inside what the notes and the meeting date support."""

from __future__ import annotations

import calendar
import re
from datetime import date, timedelta

_MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}
_MONTH = (
    "january|february|march|april|may|june|july|august|september|"
    "october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)
_DAY = r"(\d{1,2})(?:st|nd|rd|th)?"
_MONTH_DAY_YEAR = re.compile(
    rf"\b({_MONTH})\s+{_DAY}(?:,)?\s+(20\d{{2}})\b",
    re.IGNORECASE,
)
_ISO = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
_MONTH_DAY = re.compile(rf"\b({_MONTH})\s+{_DAY}\b", re.IGNORECASE)
_WEEKDAY = "monday|tuesday|wednesday|thursday|friday|saturday|sunday"
_NEXT_WEEKDAY = re.compile(rf"\bnext\s+({_WEEKDAY})\b", re.IGNORECASE)
_IN_DAYS = re.compile(r"\bin\s+(\d{1,2})\s+days?\b", re.IGNORECASE)
_TOMORROW = re.compile(r"\btomorrow\b", re.IGNORECASE)
_TODAY = re.compile(r"\btoday\b", re.IGNORECASE)
_WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}
_APPROVAL = re.compile(
    r"\b("
    r"approv(?:e|ed|es|al)|"
    r"voted to|voted for|unanimously|"
    r"agreed to|decided to|adopted|"
    r"motion (?:carried|passed)"
    r")\b",
    re.IGNORECASE,
)
_TENTATIVE = re.compile(
    r"\b(tentative(?:ly)?|maybe|might|proposed|proposal|suggest(?:ed|ion)?)\b",
    re.IGNORECASE,
)
# A quote that merely contains "approve" is not a decision when the same
# sentence denies, postpones, or conditions that approval.
_UNCONFIRMED = re.compile(
    r"("
    r"\b(?:did|do|does|was|were|is|are|has|have|had)(?:\s+not|n't)\b.{0,80}?\bapprov|"
    r"\bnot\s+(?:to\s+)?approv|"
    r"\bno\s+approval\b|"
    r"\bwithout\s+(?:a\s+)?(?:vote|approval)\b|"
    r"\bno\s+vote\b|"
    r"\bpostpon(?:e|ed|ing)\b|"
    r"\bdefer(?:red|ring)?\b|"
    r"\btabled\b|"
    r"\bwhether\s+to\b|"
    r"\bif\s+(?:we|the|they|it)\b.{0,40}?\bapprov|"
    r"\b(?:would|could|should|might)\s+approv|"
    r"\bhypothetically\b"
    r")",
    re.IGNORECASE | re.DOTALL,
)
_DISCUSSION = re.compile(
    r"\b(discussed|discussing|discussion|talked about|mentioned)\b",
    re.IGNORECASE,
)
_FOLLOW_UP = re.compile(
    r"\b("
    r"will|shall|agreed to|assigned|needs to|need to|must|should|"
    r"follow(?:\s+|-)up|responsible for|action item|"
    r"to (?:prepare|send|submit|file|email|reserve|complete|draft|share|post)"
    r")\b",
    re.IGNORECASE,
)
_MONEY = re.compile(r"\$\s*\d[\d,]*(?:\.\d{1,2})?")
_UNANIMOUS = re.compile(r"\bunanimous(?:ly)?\b", re.IGNORECASE)
_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_FORWARD_WINDOW_DAYS = 92
_RECENT_PAST_DAYS = 60
_MIN_EVIDENCE_CHARS = 8


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def evidence_in_notes(notes: str, evidence: str) -> bool:
    quote = _norm(evidence)
    if len(quote) < _MIN_EVIDENCE_CHARS:
        return False
    return quote in _norm(notes)


def _valid_date(year: int, month: int, day: int) -> date | None:
    if month < 1 or month > 12:
        return None
    if day < 1 or day > calendar.monthrange(year, month)[1]:
        return None
    return date(year, month, day)


def _covered(span: tuple[int, int], spans: list[tuple[int, int]]) -> bool:
    start, end = span
    return any(start < other_end and end > other_start for other_start, other_end in spans)


def _partial_date(month: int, day: int, meeting: date) -> date | None:
    """Use the meeting year, or the next year only for a near year-end wrap."""
    candidate = _valid_date(meeting.year, month, day)
    if candidate is None:
        return None
    if candidate >= meeting:
        return candidate
    if (meeting - candidate).days <= _RECENT_PAST_DAYS:
        return candidate
    upcoming = _valid_date(meeting.year + 1, month, day)
    if upcoming is None:
        return None
    if 0 < (upcoming - meeting).days <= _FORWARD_WINDOW_DAYS:
        return upcoming
    return None


def dates_in_text(text: str, meeting: date | None) -> set[date] | None:
    """Return one grounded date, an empty set, or None when the text disagrees with itself."""
    found: list[date] = []
    occupied: list[tuple[int, int]] = []

    for match in _MONTH_DAY_YEAR.finditer(text):
        parsed = _valid_date(
            int(match.group(3)),
            _MONTHS[match.group(1).casefold()],
            int(match.group(2)),
        )
        if parsed is None:
            return None
        found.append(parsed)
        occupied.append(match.span())

    for match in _ISO.finditer(text):
        if _covered(match.span(), occupied):
            continue
        parsed = _valid_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        if parsed is None:
            return None
        found.append(parsed)
        occupied.append(match.span())

    if meeting is not None:
        for match in _MONTH_DAY.finditer(text):
            if _covered(match.span(), occupied):
                continue
            parsed = _partial_date(
                _MONTHS[match.group(1).casefold()],
                int(match.group(2)),
                meeting,
            )
            if parsed is None:
                return None
            found.append(parsed)
            occupied.append(match.span())

        for match in _NEXT_WEEKDAY.finditer(text):
            if _covered(match.span(), occupied):
                continue
            weekday = _WEEKDAY_INDEX[match.group(1).casefold()]
            delta = (weekday - meeting.weekday()) % 7
            if delta == 0:
                delta = 7
            found.append(meeting + timedelta(days=delta))
            occupied.append(match.span())

        for match in _IN_DAYS.finditer(text):
            if _covered(match.span(), occupied):
                continue
            days = int(match.group(1))
            if days < 1 or days > 60:
                return None
            found.append(meeting + timedelta(days=days))
            occupied.append(match.span())

        if _TOMORROW.search(text):
            found.append(meeting + timedelta(days=1))
        if _TODAY.search(text):
            found.append(meeting)

    unique = set(found)
    if len(unique) > 1:
        return None
    return unique


def ground_deadline(
    *,
    notes: str,
    evidence: str,
    model_due: str | None,
    meeting: date | None,
) -> str | None:
    """Return an ISO date supported by the notes, or None for a person to fill in."""
    if evidence_in_notes(notes, evidence):
        from_evidence = dates_in_text(evidence, meeting)
        if from_evidence is None:
            return None
        if len(from_evidence) == 1:
            return next(iter(from_evidence)).isoformat()

    due = (model_due or "").strip()
    if due and _norm(due) in _norm(notes):
        from_due = dates_in_text(due, meeting)
        if from_due is not None and len(from_due) == 1:
            return next(iter(from_due)).isoformat()
    return None


def _invented_money(text: str, notes: str) -> bool:
    compact_notes = re.sub(r"\s+", "", notes).casefold()
    for amount in _MONEY.findall(text):
        if re.sub(r"\s+", "", amount).casefold() not in compact_notes:
            return True
    return False


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [part.strip() for part in parts if part.strip()]


def _sentence_is_confirmed_approval(sentence: str) -> bool:
    if _TENTATIVE.search(sentence) or _UNCONFIRMED.search(sentence):
        return False
    return _APPROVAL.search(sentence) is not None


def _notes_have_confirmed_approval(notes: str) -> bool:
    return any(_sentence_is_confirmed_approval(sentence) for sentence in _sentences(notes))


def _evidence_confirms_approval(notes: str, evidence: str) -> bool:
    """The notes sentence that contains the quote has to be an actual approval."""
    quote = _norm(evidence)
    matched = [sentence for sentence in _sentences(notes) if quote in _norm(sentence)]
    if not matched:
        return _sentence_is_confirmed_approval(evidence)
    return all(_sentence_is_confirmed_approval(sentence) for sentence in matched)


def _assigned_follow_up(notes: str, evidence: str) -> bool:
    """A discussion, with no assignment in that sentence, is not an action item."""
    quote = _norm(evidence)
    matched = [sentence for sentence in _sentences(notes) if quote in _norm(sentence)]
    targets = matched or [evidence]
    return any(
        _DISCUSSION.search(sentence) is None or _FOLLOW_UP.search(sentence) is not None
        for sentence in targets
    )


def ground_summary(summary: str, notes: str) -> str:
    """Drop approval sentences when the notes never record an approval."""
    cleaned = summary.strip()
    if not cleaned or _notes_have_confirmed_approval(notes):
        return cleaned

    paragraphs: list[str] = []
    for paragraph in re.split(r"\n\s*\n", cleaned):
        kept = [
            sentence
            for sentence in _SENTENCE.split(paragraph.strip())
            if sentence.strip()
            and not _APPROVAL.search(sentence)
            and not _UNANIMOUS.search(sentence)
        ]
        if kept:
            paragraphs.append(" ".join(sentence.strip() for sentence in kept))
    if paragraphs:
        return "\n\n".join(paragraphs)
    return "The notes record the board's discussion. They do not record an approved decision."


def ground_decision(notes: str, text: str, evidence: str) -> str | None:
    decision = text.strip()
    if not decision or not evidence_in_notes(notes, evidence):
        return None
    if not _evidence_confirms_approval(notes, evidence):
        return None
    if _invented_money(decision, notes):
        return None
    if _UNANIMOUS.search(decision) and not _UNANIMOUS.search(notes):
        return None
    return decision


def ground_action_item(
    *,
    notes: str,
    task: str,
    owner: str | None,
    due: str | None,
    evidence: str,
    meeting: date | None,
) -> dict[str, str | None] | None:
    cleaned_task = task.strip()
    if not cleaned_task or not evidence_in_notes(notes, evidence):
        return None
    if not _assigned_follow_up(notes, evidence):
        return None
    if _invented_money(cleaned_task, notes):
        return None
    cleaned_owner = owner.strip() if owner else None
    if cleaned_owner and cleaned_owner.casefold() not in notes.casefold():
        cleaned_owner = None
    return {
        "task": cleaned_task,
        "owner": cleaned_owner or None,
        "due": ground_deadline(
            notes=notes,
            evidence=evidence,
            model_due=due,
            meeting=meeting,
        ),
    }
