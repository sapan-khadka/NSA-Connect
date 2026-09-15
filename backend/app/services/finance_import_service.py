from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from io import StringIO

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.lib.event_finance import EventFinanceLockedError, is_event_finance_locked
from app.lib.finance_categories import normalize_finance_category
from app.models.event import Event
from app.models.finance_entry import FinanceEntryType
from app.models.member import Member
from app.schemas.finance import (
    FinanceEntryCreateRequest,
    FinanceImportPreviewRow,
    FinanceImportResponse,
    FinanceImportSkippedRow,
)
from app.services.finance_service import create_finance_entry
from app.services.organization_context import get_default_organization_id

IMPORT_CHUNK_SIZE = 50
CHUNK_FAILURE_REASON = "Could not save this import chunk"
MAX_DESCRIPTION_LENGTH = 5000

REQUIRED_COLUMNS = {"date", "category", "event", "price"}

CATEGORY_ALIASES = {
    "grocery": "food_beverage",
    "groceries": "food_beverage",
    "grocery_total": "food_beverage",
    "food": "food_beverage",
    "foods": "food_beverage",
    "catering": "food_beverage",
    "venue": "venue",
    "supplies": "supplies",
    "marketing": "marketing",
    "travel": "travel",
    "donation": "donation",
    "fundraising": "fundraising",
    "sponsorship": "sponsorship",
    "membership_dues": "membership_dues",
    "dues": "membership_dues",
    "event": "event",
}

SKIP_TEXT_PATTERN = re.compile(
    r"(?:"
    r"^\s*total(?:\s+expenditure|\s+funding)?\s*$|"
    r".+\s+total\s*$|"
    r"previous\s+fund|"
    r"current\s+fund|"
    r"summary(?:\s+panel)?|"
    r"expense\s+sheet"
    r")",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class _ParsedReadyRow:
    row_number: int
    created_at: datetime
    category: str
    amount: Decimal
    description: str
    event_id: int | None
    event_title: str | None


def _normalize_header(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.strip().lower())


def _normalize_event_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _cell(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        if key in row and row[key].strip():
            return row[key].strip()
    return ""


def _raw_excerpt(row: dict[str, str]) -> str:
    parts = [value.strip() for value in row.values() if value and value.strip()]
    excerpt = " | ".join(parts)
    return excerpt[:200] if excerpt else None


def _parse_date(raw: str) -> datetime | None:
    text = raw.strip()
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def _parse_price(raw: str) -> Decimal | None:
    text = raw.strip()
    if not text:
        return None
    cleaned = text.replace("$", "").replace(",", "").strip()
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = f"-{cleaned[1:-1].strip()}"
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    if amount <= 0:
        return None
    if amount != amount.quantize(Decimal("0.01")):
        amount = amount.quantize(Decimal("0.01"))
    return amount


def _map_category(raw: str) -> str:
    normalized = normalize_finance_category(raw)
    return CATEGORY_ALIASES.get(normalized, normalized)


def _build_description(vendor: str, quantity: str) -> str:
    parts: list[str] = []
    if vendor:
        parts.append(vendor)
    if quantity:
        parts.append(f"(qty {quantity})")
    description = " ".join(parts).strip()
    if not description:
        description = "Imported expense"
    return description[:MAX_DESCRIPTION_LENGTH]


def _find_header_row(
    rows: list[list[str]],
) -> tuple[int, dict[str, int]] | None:
    for index, cells in enumerate(rows):
        mapping: dict[str, int] = {}
        for col_index, cell in enumerate(cells):
            key = _normalize_header(cell)
            if key in {"date", "category", "quantity", "event", "vendor", "price"}:
                mapping[key] = col_index
        if REQUIRED_COLUMNS.issubset(mapping):
            return index, mapping
    return None


def _match_event(
    event_name: str,
    events: list[Event],
) -> tuple[Event | None, str | None]:
    if not event_name.strip():
        return None, None

    needle = _normalize_event_key(event_name)
    exact = [event for event in events if _normalize_event_key(event.title) == needle]
    if len(exact) == 1:
        return exact[0], None
    if len(exact) > 1:
        return None, "Ambiguous event name"

    fuzzy = [
        event
        for event in events
        if needle in _normalize_event_key(event.title)
        or _normalize_event_key(event.title) in needle
    ]
    if len(fuzzy) == 1:
        return fuzzy[0], None
    if len(fuzzy) > 1:
        return None, "Ambiguous event name"
    return None, "No matching event"


def _row_dict_from_cells(
    cells: list[str],
    mapping: dict[str, int],
) -> dict[str, str]:
    result: dict[str, str] = {}
    for key, index in mapping.items():
        result[key] = cells[index].strip() if index < len(cells) and cells[index] else ""
    return result


def _parse_ready_rows(
    db: Session,
    file_bytes: bytes,
) -> tuple[list[_ParsedReadyRow], list[FinanceImportSkippedRow]]:
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [
            FinanceImportSkippedRow(
                row_number=1,
                reason="CSV must be UTF-8 encoded",
                raw_excerpt=None,
            )
        ]

    reader = csv.reader(StringIO(text))
    all_rows = list(reader)
    if not all_rows:
        return [], [
            FinanceImportSkippedRow(
                row_number=1,
                reason="CSV is empty",
                raw_excerpt=None,
            )
        ]

    header = _find_header_row(all_rows)
    if header is None:
        return [], [
            FinanceImportSkippedRow(
                row_number=1,
                reason=(
                    "CSV is missing required columns: "
                    + ", ".join(sorted(REQUIRED_COLUMNS))
                ),
                raw_excerpt=None,
            )
        ]

    header_index, mapping = header
    org_id = get_default_organization_id(db)
    events = list(
        db.scalars(
            select(Event).where(Event.organization_id == org_id).order_by(Event.id)
        ).all()
    )

    ready: list[_ParsedReadyRow] = []
    skipped: list[FinanceImportSkippedRow] = []

    for offset, cells in enumerate(all_rows[header_index + 1 :], start=header_index + 2):
        if not any(cell.strip() for cell in cells if cell):
            continue

        row = _row_dict_from_cells(cells, mapping)
        excerpt = _raw_excerpt(row)
        date_raw = _cell(row, "date")
        category_raw = _cell(row, "category")
        quantity_raw = _cell(row, "quantity")
        event_raw = _cell(row, "event")
        vendor_raw = _cell(row, "vendor")
        price_raw = _cell(row, "price")

        marker_blob = " ".join(
            part
            for part in (category_raw, event_raw, vendor_raw, quantity_raw)
            if part
        )
        if marker_blob and SKIP_TEXT_PATTERN.search(marker_blob):
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason="Skipped total or summary row",
                    raw_excerpt=excerpt,
                )
            )
            continue

        if not date_raw and not price_raw:
            continue

        created_at = _parse_date(date_raw)
        if created_at is None:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason="Missing or invalid date",
                    raw_excerpt=excerpt,
                )
            )
            continue

        amount = _parse_price(price_raw)
        if amount is None:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason="Missing or invalid price",
                    raw_excerpt=excerpt,
                )
            )
            continue

        if not category_raw:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason="Missing category",
                    raw_excerpt=excerpt,
                )
            )
            continue

        try:
            category = _map_category(category_raw)
        except ValueError as exc:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason=str(exc),
                    raw_excerpt=excerpt,
                )
            )
            continue

        event, event_error = _match_event(event_raw, events)
        if event_error is not None:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason=event_error,
                    raw_excerpt=excerpt,
                )
            )
            continue

        if event is not None and is_event_finance_locked(event):
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=offset,
                    reason="Event finances are closed",
                    raw_excerpt=excerpt,
                )
            )
            continue

        description = _build_description(vendor_raw, quantity_raw)
        ready.append(
            _ParsedReadyRow(
                row_number=offset,
                created_at=created_at,
                category=category,
                amount=amount,
                description=description,
                event_id=event.id if event is not None else None,
                event_title=event.title if event is not None else None,
            )
        )

    return ready, skipped


def _to_preview(row: _ParsedReadyRow) -> FinanceImportPreviewRow:
    return FinanceImportPreviewRow(
        row_number=row.row_number,
        date=row.created_at,
        entry_type=FinanceEntryType.EXPENSE,
        category=row.category,
        amount=row.amount,
        description=row.description,
        event_id=row.event_id,
        event_title=row.event_title,
    )


def _commit_chunk(
    db: Session,
    chunk_size: int,
    skipped: list[FinanceImportSkippedRow],
    chunk_meta: list[FinanceImportSkippedRow],
) -> int:
    if chunk_size <= 0:
        return 0
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        skipped.extend(
            row.model_copy(update={"reason": CHUNK_FAILURE_REASON})
            for row in chunk_meta
        )
        chunk_meta.clear()
        return 0
    chunk_meta.clear()
    return chunk_size


def import_finance_csv(
    db: Session,
    file_bytes: bytes,
    *,
    created_by: Member,
    dry_run: bool = True,
) -> FinanceImportResponse:
    ready, skipped = _parse_ready_rows(db, file_bytes)
    preview_rows = [_to_preview(row) for row in ready]

    if dry_run:
        return FinanceImportResponse(
            rows_created=0,
            rows_ready=len(ready),
            rows_skipped=len(skipped),
            skipped_rows=skipped,
            preview_rows=preview_rows,
        )

    created = 0
    chunk_count = 0
    chunk_meta: list[FinanceImportSkippedRow] = []

    for row in ready:
        try:
            data = FinanceEntryCreateRequest(
                entry_type=FinanceEntryType.EXPENSE,
                category=row.category,
                amount=row.amount,
                description=row.description,
                event_id=row.event_id,
            )
        except ValidationError as exc:
            skipped.append(
                FinanceImportSkippedRow(
                    row_number=row.row_number,
                    reason=str(exc.errors()[0].get("msg", "Invalid row")),
                    raw_excerpt=row.description,
                )
            )
            continue

        pending = FinanceImportSkippedRow(
            row_number=row.row_number,
            reason="",
            raw_excerpt=row.description,
        )
        chunk_meta.append(pending)
        try:
            create_finance_entry(
                db,
                data,
                created_by=created_by,
                created_at=row.created_at,
                commit=False,
            )
            chunk_count += 1
        except EventFinanceLockedError:
            db.rollback()
            # Rollback drops the whole in-flight chunk; report those rows.
            skipped.extend(
                item.model_copy(update={"reason": "Event finances are closed"})
                for item in chunk_meta
            )
            chunk_meta.clear()
            chunk_count = 0
            continue
        except SQLAlchemyError:
            db.rollback()
            skipped.extend(
                item.model_copy(update={"reason": CHUNK_FAILURE_REASON})
                for item in chunk_meta
            )
            chunk_meta.clear()
            chunk_count = 0
            continue

        if chunk_count == IMPORT_CHUNK_SIZE:
            created += _commit_chunk(db, chunk_count, skipped, chunk_meta)
            chunk_count = 0

    created += _commit_chunk(db, chunk_count, skipped, chunk_meta)

    return FinanceImportResponse(
        rows_created=created,
        rows_ready=created,
        rows_skipped=len(skipped),
        skipped_rows=skipped,
        preview_rows=preview_rows[:created] if created else [],
    )
