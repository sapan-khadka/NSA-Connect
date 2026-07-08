"""Tests for global API error handling — no internal details leak to clients."""

import pytest
from fastapi.testclient import TestClient
from conftest import auth_header, create_board_member, register_member, set_member_approved
from app.core.database import get_db
from app.main import app as fastapi_app

from app.core.safe_messages import (
    GENERIC_AI_UNAVAILABLE,
    GENERIC_CONFLICT_ERROR,
    GENERIC_SERVER_ERROR,
)


@pytest.fixture(autouse=True)
def force_production_error_responses(monkeypatch):
    """Ensure global handlers return JSON, not HTML tracebacks, during this module."""
    monkeypatch.setattr(fastapi_app, "debug", False)


@pytest.fixture(autouse=True)
def force_production_error_responses(monkeypatch):
    """Ensure global handlers return JSON, not HTML tracebacks, during this module."""
    monkeypatch.setattr(fastapi_app, "debug", False)


@pytest.fixture
def client_no_raise(db_session, monkeypatch):
    monkeypatch.setattr(fastapi_app, "debug", False)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def test_unhandled_exception_returns_generic_500(client_no_raise, db_session, monkeypatch):
    register_member(client_no_raise)
    set_member_approved(db_session)

    def explode(*args, **kwargs):
        raise RuntimeError("secret internal db_password=leak")

    monkeypatch.setattr(
        "app.api.v1.members.list_members_paginated",
        explode,
    )

    response = client_no_raise.get(
        "/api/v1/members",
        headers=auth_header(client_no_raise),
    )

    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == GENERIC_SERVER_ERROR
    assert "secret" not in response.text.lower()
    assert "traceback" not in response.text.lower()
    assert "runtimeerror" not in response.text.lower()


def test_validation_error_returns_friendly_422_not_raw_pydantic(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "missing@semo.edu",
            "password": "securepass123",
            "student_id": "12345678",
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert "errors" in body
    assert isinstance(body["detail"], str)
    assert "pydantic" not in body["detail"].lower()
    assert "traceback" not in response.text.lower()
    assert any("required" in item["message"].lower() for item in body["errors"])


def test_ai_endpoint_masks_internal_provider_errors(
    client_no_raise,
    db_session,
    monkeypatch,
):
    create_board_member(db_session)
    headers = auth_header(client_no_raise, email="board@semo.edu")

    def fake_generate(**kwargs):
        raise RuntimeError("anthropic secret api key invalid")

    monkeypatch.setattr(
        "app.api.v1.ai.generate_event_checklist",
        fake_generate,
    )

    response = client_no_raise.post(
        "/api/v1/ai/generate-checklist",
        headers=headers,
        json={
            "event_name": "Spring Social",
            "event_type": "social",
        },
    )

    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == GENERIC_SERVER_ERROR
    assert "anthropic" not in response.text.lower()


def test_ai_known_failure_returns_generic_message_not_provider_detail(
    client,
    db_session,
    monkeypatch,
):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    from app.services.ai_checklist_service import AIChecklistGenerationError

    def fake_generate(**kwargs):
        raise AIChecklistGenerationError("Anthropic returned invalid JSON")

    monkeypatch.setattr(
        "app.api.v1.ai.generate_event_checklist",
        fake_generate,
    )

    response = client.post(
        "/api/v1/ai/generate-checklist",
        headers=headers,
        json={
            "event_name": "Spring Social",
            "event_type": "social",
        },
    )

    assert response.status_code == 502
    body = response.json()
    assert body["detail"] == GENERIC_AI_UNAVAILABLE
    assert "anthropic" not in response.text.lower()
    assert "json" not in response.text.lower()


def test_integrity_error_returns_generic_conflict(
    client_no_raise,
    db_session,
    monkeypatch,
):
    register_member(client_no_raise)
    set_member_approved(db_session)

    from sqlalchemy.exc import IntegrityError

    def boom(*args, **kwargs):
        raise IntegrityError("INSERT", {}, Exception("duplicate key members_email_key"))

    monkeypatch.setattr(
        "app.api.v1.members.list_members_paginated",
        boom,
    )

    response = client_no_raise.get(
        "/api/v1/members",
        headers=auth_header(client_no_raise),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == GENERIC_CONFLICT_ERROR
    assert "duplicate key" not in response.text.lower()


def test_notification_test_email_masks_resend_errors(client, db_session, monkeypatch):
    create_board_member(db_session)
    headers = auth_header(client, email="board@semo.edu")

    from app.integrations.resend_client import ResendDeliveryError
    import app.api.v1.notifications as notifications_api

    def fake_send(**kwargs):
        raise ResendDeliveryError("Resend API 401 unauthorized key=sk_live_secret")

    monkeypatch.setattr(notifications_api, "send_test_email", fake_send)

    response = client.post(
        "/api/v1/notifications/test-email",
        headers=headers,
        json={"to_email": "board@semo.edu"},
    )

    assert response.status_code == 502
    body = response.json()
    assert "resend" not in body["detail"].lower()
    assert "sk_live" not in response.text.lower()
