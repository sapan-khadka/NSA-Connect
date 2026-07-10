from io import BytesIO
from unittest.mock import MagicMock

import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)

from tests.helpers.openai_mocks import (
    SAMPLE_RECEIPT_SCAN_PAYLOAD,
    UNREADABLE_RECEIPT_SCAN_PAYLOAD,
    mock_openai_receipt_scan_api,
)

TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


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


@pytest.fixture
def treasurer_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


def _scan_file(
    client,
    headers,
    *,
    content=TINY_PNG,
    filename="receipt.png",
    content_type="image/png",
):
    return client.post(
        "/api/v1/finance/receipts/scan",
        files={"file": (filename, BytesIO(content), content_type)},
        headers=headers,
    )


def test_treasurer_can_scan_receipt(client, treasurer_headers):
    with mock_openai_receipt_scan_api() as mock_client:
        response = _scan_file(client, treasurer_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["readable"] is True
    assert body["vendor"] == "Walmart"
    assert body["purchase_date"] == "2026-03-15"
    assert body["amount"] == "24.67"
    assert "Milk" in body["description"]
    assert body["category"] == "food_beverage"
    assert body["confidence"] == "high"
    mock_client.chat.completions.create.assert_called_once()


def test_scan_receipt_never_calls_openai_sdk(
    client,
    treasurer_headers,
    block_external_integrations,
):
    with mock_openai_receipt_scan_api():
        response = _scan_file(client, treasurer_headers)

    assert response.status_code == 200
    block_external_integrations["openai_client"].assert_not_called()


def test_board_member_cannot_scan_receipt(client, board_member_headers):
    response = _scan_file(client, board_member_headers)

    assert response.status_code == 403


def test_president_can_scan_receipt(client, db_session):
    from conftest import create_president_member

    register_member(client, email="other@semo.edu", student_id="22222222")
    create_president_member(db_session)
    headers = auth_header(client, email="president@semo.edu")

    with mock_openai_receipt_scan_api():
        response = _scan_file(client, headers)

    assert response.status_code == 200
    assert response.json()["readable"] is True


def test_vice_president_can_scan_receipt(client, db_session):
    from conftest import create_vice_president_member

    register_member(client, email="other@semo.edu", student_id="22222222")
    create_vice_president_member(db_session)
    headers = auth_header(client, email="vp@semo.edu")

    with mock_openai_receipt_scan_api():
        response = _scan_file(client, headers)

    assert response.status_code == 200
    assert response.json()["readable"] is True


def test_general_member_cannot_scan_receipt(client, general_member_headers):
    response = _scan_file(client, general_member_headers)

    assert response.status_code == 403


def test_scan_receipt_returns_503_when_ai_disabled(client, treasurer_headers):
    with mock_openai_receipt_scan_api(ai_enabled=False):
        response = _scan_file(client, treasurer_headers)

    assert response.status_code == 503
    assert response.json()["detail"] == "AI features are disabled"


def test_scan_receipt_returns_unreadable_payload(client, treasurer_headers):
    with mock_openai_receipt_scan_api(UNREADABLE_RECEIPT_SCAN_PAYLOAD):
        response = _scan_file(client, treasurer_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["readable"] is False
    assert body["amount"] is None
    assert body["confidence"] == "low"


def test_scan_receipt_returns_502_for_invalid_ai_response(client, treasurer_headers):
    with mock_openai_receipt_scan_api() as mock_client:
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="not-json"))],
        )
        response = _scan_file(client, treasurer_headers)

    assert response.status_code == 502
    from app.core.safe_messages import GENERIC_AI_UNAVAILABLE

    assert response.json()["detail"] == GENERIC_AI_UNAVAILABLE


def test_scan_receipt_rejects_pdf(client, treasurer_headers):
    with mock_openai_receipt_scan_api() as mock_client:
        response = _scan_file(
            client,
            treasurer_headers,
            content=b"%PDF-1.4 fake",
            filename="receipt.pdf",
            content_type="application/pdf",
        )

    assert response.status_code == 422
    mock_client.chat.completions.create.assert_not_called()


def test_scan_receipt_rejects_empty_file(client, treasurer_headers):
    with mock_openai_receipt_scan_api() as mock_client:
        response = _scan_file(client, treasurer_headers, content=b"")

    assert response.status_code == 422
    mock_client.chat.completions.create.assert_not_called()


def test_scan_receipt_uses_sample_payload_shape():
    assert SAMPLE_RECEIPT_SCAN_PAYLOAD["amount"] == "24.67"
