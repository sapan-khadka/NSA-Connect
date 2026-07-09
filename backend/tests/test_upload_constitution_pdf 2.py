import pytest
from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

from app.models.constitutional_chunk import ConstitutionalChunk
from tests.helpers.pdf_fixtures import SAMPLE_CONSTITUTION_PDF

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


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


def test_board_member_can_upload_constitution_pdf(
    client,
    board_member_headers,
    db_session,
):
    response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files={
            "file": (
                "nsa-constitution.pdf",
                SAMPLE_CONSTITUTION_PDF,
                "application/pdf",
            ),
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["page_count"] == 1
    assert body["char_count"] > 0
    assert body["filename"] == "nsa-constitution.pdf"
    assert body["chunk_size_tokens"] == 800
    assert body["overlap_tokens"] == 200
    assert body["chunk_count"] >= 1
    assert len(body["chunks"]) == body["chunk_count"]
    assert "NSA Constitution Article I" in body["chunks"][0]["content"]
    assert body["chunks"][0]["token_count"] >= 1
    assert body["chunks"][0]["id"] >= 1

    rows = (
        db_session.query(ConstitutionalChunk)
        .order_by(
            ConstitutionalChunk.chunk_index,
        )
        .all()
    )
    assert len(rows) == body["chunk_count"]
    assert all(len(row.embedding) == 1536 for row in rows)
    assert rows[0].content == body["chunks"][0]["content"]


def test_upload_replaces_existing_constitution_chunks(
    client,
    board_member_headers,
    db_session,
):
    upload = {
        "file": (
            "nsa-constitution.pdf",
            SAMPLE_CONSTITUTION_PDF,
            "application/pdf",
        ),
    }

    first = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files=upload,
    )
    second = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files=upload,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert db_session.query(ConstitutionalChunk).count() == second.json()["chunk_count"]


def test_upload_returns_503_when_openai_not_configured(
    client,
    board_member_headers,
    monkeypatch,
):
    monkeypatch.setattr("app.core.config.settings.OPENAI_API_KEY", "")

    response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files={
            "file": (
                "nsa-constitution.pdf",
                SAMPLE_CONSTITUTION_PDF,
                "application/pdf",
            ),
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Embedding generation is not configured"


def test_general_member_cannot_upload_constitution_pdf(
    client,
    general_member_headers,
):
    response = client.post(
        "/api/v1/constitution/upload",
        headers=general_member_headers,
        files={
            "file": (
                "nsa-constitution.pdf",
                SAMPLE_CONSTITUTION_PDF,
                "application/pdf",
            ),
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_upload_constitution_pdf_requires_authentication(client):
    response = client.post(
        "/api/v1/constitution/upload",
        files={
            "file": (
                "nsa-constitution.pdf",
                SAMPLE_CONSTITUTION_PDF,
                "application/pdf",
            ),
        },
    )

    assert response.status_code == 401


def test_upload_constitution_pdf_rejects_non_pdf_type(client, board_member_headers):
    response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_constitution_pdf_rejects_empty_file(client, board_member_headers):
    response = client.post(
        "/api/v1/constitution/upload",
        headers=board_member_headers,
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "PDF file is empty"
