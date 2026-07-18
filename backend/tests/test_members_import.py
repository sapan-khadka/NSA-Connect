import csv
from io import StringIO
from unittest.mock import patch

import pytest
from conftest import (
    VALID_GRADUATION_YEAR,
    VALID_MAJOR,
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.models.member import Member, MemberStatus
from app.models.password_reset_token import PasswordResetToken
from app.services import member_import_service
from app.services.member_import_service import (
    CHUNK_FAILURE_REASON,
    IMPORT_CHUNK_SIZE,
    import_members_csv,
)
from app.services.member_service import create_invited_member

BOARD_REQUIRED_DETAIL = "Requires board role or higher"
CSV_HEADERS = [
    "full_name",
    "email",
    "student_id",
    "major",
    "graduation_year",
]


def _csv_bytes(rows: list[dict]) -> bytes:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue().encode("utf-8")


def _row(
    index: int,
    *,
    email: str | None = None,
    student_id: str | None = None,
    major: str = VALID_MAJOR,
    graduation_year: int = VALID_GRADUATION_YEAR,
) -> dict:
    return {
        "full_name": f"Import Member {index}",
        "email": email or f"import{index:04d}@semo.edu",
        "student_id": student_id or f"{10000000 + index}",
        "major": major,
        "graduation_year": graduation_year,
    }


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_board_can_import_valid_row(client, db_session, board_member_headers):
    payload = _csv_bytes([_row(1)])

    response = client.post(
        "/api/v1/members/import",
        headers=board_member_headers,
        files={"file": ("members.csv", payload, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 1
    assert body["rows_skipped"] == 0

    member = db_session.scalar(
        select(Member).where(Member.email == "import0001@semo.edu")
    )
    assert member is not None
    assert member.status == MemberStatus.APPROVED
    assert member.role.value == "general"
    token_count = db_session.scalar(
        select(func.count())
        .select_from(PasswordResetToken)
        .where(PasswordResetToken.member_id == member.id)
    )
    assert token_count == 1


def test_general_member_cannot_import(client, general_member_headers):
    response = client.post(
        "/api/v1/members/import",
        headers=general_member_headers,
        files={"file": ("members.csv", _csv_bytes([_row(1)]), "text/csv")},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_import_skips_duplicate_email(client, db_session, board_member_headers):
    register_member(client, email="existing@semo.edu", student_id="33333333")
    set_member_approved(db_session, email="existing@semo.edu")

    payload = _csv_bytes(
        [
            _row(1, email="existing@semo.edu", student_id="44444444"),
        ]
    )
    response = client.post(
        "/api/v1/members/import",
        headers=board_member_headers,
        files={"file": ("members.csv", payload, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 0
    assert body["rows_skipped"] == 1
    assert body["skipped_rows"][0]["reason"] == "Email already registered"


def test_import_skips_duplicate_student_id(client, db_session, board_member_headers):
    register_member(client, email="existing2@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="existing2@semo.edu")

    payload = _csv_bytes(
        [
            _row(1, email="fresh@semo.edu", student_id="55555555"),
        ]
    )
    response = client.post(
        "/api/v1/members/import",
        headers=board_member_headers,
        files={"file": ("members.csv", payload, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 0
    assert body["rows_skipped"] == 1
    assert body["skipped_rows"][0]["reason"] == "Student ID already registered"


def test_import_skips_malformed_row(client, board_member_headers):
    payload = _csv_bytes(
        [
            {
                "full_name": "Bad Email",
                "email": "bad@gmail.com",
                "student_id": "66666666",
                "major": VALID_MAJOR,
                "graduation_year": VALID_GRADUATION_YEAR,
            }
        ]
    )
    response = client.post(
        "/api/v1/members/import",
        headers=board_member_headers,
        files={"file": ("members.csv", payload, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 0
    assert body["rows_skipped"] == 1
    assert "email" in body["skipped_rows"][0]["reason"].lower()


def test_import_mixed_partial_success(client, board_member_headers):
    payload = _csv_bytes(
        [
            _row(1),
            {
                "full_name": "Bad",
                "email": "not-semo@example.com",
                "student_id": "77777777",
                "major": VALID_MAJOR,
                "graduation_year": VALID_GRADUATION_YEAR,
            },
            _row(3),
        ]
    )
    response = client.post(
        "/api/v1/members/import",
        headers=board_member_headers,
        files={"file": ("members.csv", payload, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows_created"] == 2
    assert body["rows_skipped"] == 1


def test_import_infile_duplicate_email_caught_by_seen_set_before_checkpoint(
    db_session,
):
    """Duplicate before the first 50-row commit must be caught by seen sets."""
    rows = [_row(i) for i in range(1, 126)]
    # Second unique row email reused before any chunk commit can have happened.
    rows.insert(2, _row(2, email="import0002@semo.edu", student_id="10000999"))
    assert len(rows) == 126

    create_calls: list[str] = []
    real_create = create_invited_member

    def tracking_create(db, data, *, commit=True):
        create_calls.append(str(data.email))
        return real_create(db, data, commit=commit)

    with patch.object(
        member_import_service,
        "create_invited_member",
        side_effect=tracking_create,
    ):
        result = import_members_csv(db_session, _csv_bytes(rows))

    assert result.rows_created == 125
    assert result.rows_skipped == 1
    assert result.skipped_rows[0].reason == "Duplicate email in this CSV"
    assert result.skipped_rows[0].email == "import0002@semo.edu"
    assert result.skipped_rows[0].row_number == 4
    assert create_calls.count("import0002@semo.edu") == 1


def test_import_chunk_commit_failure_returns_partial_summary(db_session):
    rows = [_row(i) for i in range(1, 121)]
    assert len(rows) == 120
    assert IMPORT_CHUNK_SIZE == 50

    real_commit = db_session.commit
    commit_calls = {"count": 0}

    def flaky_commit():
        commit_calls["count"] += 1
        if commit_calls["count"] == 2:
            raise SQLAlchemyError("simulated chunk failure")
        return real_commit()

    with patch.object(db_session, "commit", side_effect=flaky_commit):
        result = import_members_csv(db_session, _csv_bytes(rows))

    assert result.rows_created == 70
    assert result.rows_skipped == 50
    assert len(result.skipped_rows) == 50
    assert all(row.reason == CHUNK_FAILURE_REASON for row in result.skipped_rows)
    assert {row.row_number for row in result.skipped_rows} == set(range(52, 102))

    persisted = list(
        db_session.scalars(
            select(Member).where(Member.email.like("import%@semo.edu"))
        ).all()
    )
    persisted_emails = {member.email for member in persisted}
    assert len(persisted) == 70
    assert "import0001@semo.edu" in persisted_emails
    assert "import0050@semo.edu" in persisted_emails
    assert "import0051@semo.edu" not in persisted_emails
    assert "import0100@semo.edu" not in persisted_emails
    assert "import0101@semo.edu" in persisted_emails
    assert "import0120@semo.edu" in persisted_emails

    token_count = db_session.scalar(
        select(func.count())
        .select_from(PasswordResetToken)
        .where(
            PasswordResetToken.member_id.in_([member.id for member in persisted]),
        )
    )
    assert token_count == 70
