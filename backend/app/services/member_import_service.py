from __future__ import annotations

import csv
from io import StringIO

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.member import Member
from app.schemas.member import (
    MemberImportResponse,
    MemberImportSkippedRow,
    MemberInviteRequest,
)
from app.services.member_service import create_invited_member
from app.services.password_reset_service import issue_password_token

IMPORT_CHUNK_SIZE = 50
CHUNK_FAILURE_REASON = "Could not save this import chunk"

REQUIRED_COLUMNS = {
    "full_name",
    "email",
    "student_id",
    "major",
    "graduation_year",
}


def humanized_validation_error(exc: ValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid row"
    first = errors[0]
    loc_parts = [str(part) for part in first.get("loc", ()) if part != "body"]
    loc = ".".join(loc_parts)
    msg = str(first.get("msg", "Invalid value"))
    if loc:
        return f"{loc}: {msg}"
    return msg


def _commit_chunk(
    db: Session,
    chunk_rows: list[MemberImportSkippedRow],
    skipped: list[MemberImportSkippedRow],
) -> int:
    if not chunk_rows:
        return 0
    count = len(chunk_rows)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        skipped.extend(
            row.model_copy(update={"reason": CHUNK_FAILURE_REASON})
            for row in chunk_rows
        )
        chunk_rows.clear()
        return 0
    chunk_rows.clear()
    return count


def import_members_csv(db: Session, file_bytes: bytes) -> MemberImportResponse:
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))
    if reader.fieldnames is None:
        return MemberImportResponse(
            rows_created=0,
            rows_skipped=1,
            skipped_rows=[
                MemberImportSkippedRow(
                    row_number=1,
                    email=None,
                    reason="CSV is missing a header row",
                )
            ],
        )

    normalized_headers = {name.strip().lower() for name in reader.fieldnames if name}
    missing = REQUIRED_COLUMNS - normalized_headers
    if missing:
        return MemberImportResponse(
            rows_created=0,
            rows_skipped=1,
            skipped_rows=[
                MemberImportSkippedRow(
                    row_number=1,
                    email=None,
                    reason=(
                        "CSV is missing required columns: "
                        + ", ".join(sorted(missing))
                    ),
                )
            ],
        )

    # Exactly one upfront query for both identity columns.
    identities = db.execute(select(Member.email, Member.student_id)).all()
    existing_emails = {email.lower() for email, _ in identities}
    existing_student_ids = {student_id.upper() for _, student_id in identities}
    seen_emails: set[str] = set()
    seen_student_ids: set[str] = set()

    created = 0
    skipped: list[MemberImportSkippedRow] = []
    chunk_rows: list[MemberImportSkippedRow] = []

    for row_number, row in enumerate(reader, start=2):
        normalized_row = {
            (key or "").strip().lower(): (value if value is not None else "")
            for key, value in row.items()
        }
        raw_email = (normalized_row.get("email") or "").strip()
        try:
            data = MemberInviteRequest.model_validate(
                {
                    "full_name": normalized_row.get("full_name"),
                    "email": raw_email,
                    "student_id": normalized_row.get("student_id"),
                    "major": normalized_row.get("major"),
                    "graduation_year": normalized_row.get("graduation_year"),
                    "phone": normalized_row.get("phone") or None,
                }
            )
        except ValidationError as exc:
            skipped.append(
                MemberImportSkippedRow(
                    row_number=row_number,
                    email=raw_email or None,
                    reason=humanized_validation_error(exc),
                )
            )
            continue

        email = str(data.email)
        student_id = data.student_id
        if email in existing_emails:
            skipped.append(
                MemberImportSkippedRow(
                    row_number=row_number,
                    email=email,
                    reason="Email already registered",
                )
            )
            continue
        if student_id in existing_student_ids:
            skipped.append(
                MemberImportSkippedRow(
                    row_number=row_number,
                    email=email,
                    reason="Student ID already registered",
                )
            )
            continue
        if email in seen_emails:
            skipped.append(
                MemberImportSkippedRow(
                    row_number=row_number,
                    email=email,
                    reason="Duplicate email in this CSV",
                )
            )
            continue
        if student_id in seen_student_ids:
            skipped.append(
                MemberImportSkippedRow(
                    row_number=row_number,
                    email=email,
                    reason="Duplicate student ID in this CSV",
                )
            )
            continue

        pending_row = MemberImportSkippedRow(
            row_number=row_number,
            email=email,
            reason="",
        )
        chunk_rows.append(pending_row)
        try:
            member = create_invited_member(db, data, commit=False)
            seen_emails.add(email)
            seen_student_ids.add(student_id)
            issue_password_token(db, member, commit=False)
        except SQLAlchemyError:
            # Flush failures poison the same transaction as commit failures;
            # discard and report every staged row in the current chunk.
            seen_emails.add(email)
            seen_student_ids.add(student_id)
            db.rollback()
            skipped.extend(
                item.model_copy(update={"reason": CHUNK_FAILURE_REASON})
                for item in chunk_rows
            )
            chunk_rows.clear()
            continue

        if len(chunk_rows) == IMPORT_CHUNK_SIZE:
            created += _commit_chunk(db, chunk_rows, skipped)

    created += _commit_chunk(db, chunk_rows, skipped)
    return MemberImportResponse(
        rows_created=created,
        rows_skipped=len(skipped),
        skipped_rows=skipped,
    )
