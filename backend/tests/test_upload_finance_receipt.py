import pytest

from conftest import (
    auth_header,
    create_treasurer_member,
    register_member,
)

MINIMAL_JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


@pytest.fixture
def treasurer_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


def test_treasurer_can_upload_receipt_image(
    client,
    treasurer_member_headers,
    block_external_integrations,
):
    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("receipt.jpg", MINIMAL_JPEG, "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["receipt_url"] == (
        "https://res.cloudinary.com/test/image/upload/v1/receipt.jpg"
    )
    assert body["public_id"] == "nsa-connect/finance-receipts/receipt"
    assert body["bytes"] == 128
    assert body["format"] == "jpg"
    assert body["resource_type"] == "image"

    block_external_integrations["cloudinary_upload_receipt"].assert_called_once()
    upload_kwargs = block_external_integrations["cloudinary_upload_receipt"].call_args.kwargs
    assert upload_kwargs["file_bytes"] == MINIMAL_JPEG
    assert upload_kwargs["folder"] == "nsa-connect/finance-receipts"


def test_uploaded_receipt_url_can_be_used_when_creating_finance_entry(
    client,
    treasurer_member_headers,
):
    upload_response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("receipt.jpg", MINIMAL_JPEG, "image/jpeg")},
    )
    receipt_url = upload_response.json()["receipt_url"]

    create_response = client.post(
        "/api/v1/finance",
        headers=treasurer_member_headers,
        json={
            "entry_type": "expense",
            "category": "food_beverage",
            "amount": "42.00",
            "description": "Snacks with receipt",
            "receipt_url": receipt_url,
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["receipt_url"] == receipt_url


@pytest.mark.parametrize(
    "filename, content, content_type",
    [
        ("receipt.png", b"\x89PNG\r\n\x1a\n", "image/png"),
        ("receipt.webp", b"RIFFxxxxWEBP", "image/webp"),
        ("receipt.pdf", b"%PDF-1.4", "application/pdf"),
    ],
)
def test_treasurer_can_upload_supported_receipt_types(
    client,
    treasurer_member_headers,
    filename,
    content,
    content_type,
):
    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": (filename, content, content_type)},
    )

    assert response.status_code == 201
    assert response.json()["receipt_url"].startswith("https://res.cloudinary.com/")


def test_upload_receipt_rejects_unsupported_file_type(
    client,
    treasurer_member_headers,
):
    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 422
    assert "Unsupported receipt file type" in response.json()["detail"]


def test_upload_receipt_rejects_empty_file(client, treasurer_member_headers):
    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Receipt file is empty"


def test_upload_receipt_rejects_file_over_size_limit(client, treasurer_member_headers):
    oversized = MINIMAL_JPEG + (b"x" * (10 * 1024 * 1024))

    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("large.jpg", oversized, "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Receipt file exceeds 10 MB limit"


def test_upload_receipt_returns_503_when_cloudinary_not_configured(
    client,
    treasurer_member_headers,
    monkeypatch,
):
    monkeypatch.setattr("app.core.config.settings.CLOUDINARY_CLOUD_NAME", "")

    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("receipt.jpg", MINIMAL_JPEG, "image/jpeg")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Receipt upload is not configured"


def test_upload_receipt_returns_502_when_cloudinary_fails(
    client,
    treasurer_member_headers,
    block_external_integrations,
):
    from app.integrations.cloudinary_client import CloudinaryUploadError

    block_external_integrations["cloudinary_upload_receipt"].side_effect = (
        CloudinaryUploadError("upload failed")
    )

    response = client.post(
        "/api/v1/finance/receipts",
        headers=treasurer_member_headers,
        files={"file": ("receipt.jpg", MINIMAL_JPEG, "image/jpeg")},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to upload receipt"
