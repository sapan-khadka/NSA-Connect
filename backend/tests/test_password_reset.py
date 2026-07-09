"""Password reset flow tests."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from conftest import (
    VALID_EMAIL,
    login_member,
    register_member,
    set_member_approved,
)
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core import rate_limit as rate_limit_module
from app.core.config import settings
from app.core.rate_limit import reset_rate_limit_redis
from app.models.password_reset_token import PasswordResetToken
from app.services.password_reset_service import PASSWORD_RESET_REQUEST_MESSAGE

RESET_REQUEST_URL = "/api/v1/auth/password-reset/request"
RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm"
NEW_PASSWORD = "river-canyon-9"
WEAK_PASSWORD = "111222333"


def _request_reset(client: TestClient, email: str = VALID_EMAIL):
    return client.post(RESET_REQUEST_URL, json={"email": email})


def _extract_token(reset_url: str) -> str:
    query = parse_qs(urlparse(reset_url).query)
    return query["token"][0]


@pytest.fixture
def capture_reset_email():
    captured: dict[str, str] = {}

    def fake_send(
        *, to_email: str, full_name: str, reset_url: str, expires_minutes: int
    ):
        captured["to_email"] = to_email
        captured["full_name"] = full_name
        captured["reset_url"] = reset_url
        captured["expires_minutes"] = str(expires_minutes)
        return "email-id"

    with patch(
        "app.services.password_reset_service.send_password_reset_email",
        side_effect=fake_send,
    ):
        yield captured


def test_password_reset_request_same_response_for_existing_and_missing_email(
    client,
    db_session,
    capture_reset_email,
):
    register_member(client)
    set_member_approved(db_session)

    existing = _request_reset(client, VALID_EMAIL)
    missing = _request_reset(client, "missing@semo.edu")

    assert existing.status_code == 200
    assert missing.status_code == 200
    assert existing.json() == missing.json()
    assert existing.json()["message"] == PASSWORD_RESET_REQUEST_MESSAGE
    assert "reset_url" in capture_reset_email


def test_password_reset_token_works_once(client, db_session, capture_reset_email):
    register_member(client)
    set_member_approved(db_session)

    response = _request_reset(client)
    assert response.status_code == 200

    token = _extract_token(capture_reset_email["reset_url"])
    confirm = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert confirm.status_code == 200

    reuse = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": "another-pass-9"},
    )
    assert reuse.status_code == 400


def test_password_reset_rejects_expired_token(
    client,
    db_session,
    capture_reset_email,
):
    register_member(client)
    set_member_approved(db_session)
    _request_reset(client)

    token = _extract_token(capture_reset_email["reset_url"])
    reset_token = db_session.scalar(select(PasswordResetToken))
    reset_token.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    response = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 400


def test_password_reset_rejects_weak_password(client, db_session, capture_reset_email):
    register_member(client)
    set_member_approved(db_session)
    _request_reset(client)

    token = _extract_token(capture_reset_email["reset_url"])
    response = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": WEAK_PASSWORD},
    )

    assert response.status_code == 400
    assert "password" in response.json()["detail"].lower()


def test_password_reset_invalidates_existing_sessions(
    client,
    db_session,
    capture_reset_email,
):
    register_member(client)
    set_member_approved(db_session)

    login = login_member(client)
    old_access_token = login.json()["access_token"]
    old_refresh_token = login.json()["refresh_token"]

    _request_reset(client)
    token = _extract_token(capture_reset_email["reset_url"])
    confirm = client.post(
        RESET_CONFIRM_URL,
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert confirm.status_code == 200

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_access_token}"},
    )
    assert me.status_code == 401

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh.status_code == 401

    new_login = login_member(client, password=NEW_PASSWORD)
    assert new_login.status_code == 200


def test_password_reset_new_request_invalidates_previous_token(
    client,
    db_session,
    capture_reset_email,
):
    register_member(client)
    set_member_approved(db_session)

    _request_reset(client)
    old_token = _extract_token(capture_reset_email["reset_url"])

    _request_reset(client)
    new_token = _extract_token(capture_reset_email["reset_url"])
    assert new_token != old_token

    response = client.post(
        RESET_CONFIRM_URL,
        json={"token": old_token, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 400


@pytest.fixture
def isolated_rate_limit_redis(monkeypatch):
    try:
        import fakeredis
    except ImportError as exc:
        pytest.skip(f"fakeredis required for rate limit tests: {exc}")

    from limits.storage import MemoryStorage
    from limits.strategies import STRATEGIES

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)

    fake = fakeredis.FakeRedis(decode_responses=True)
    reset_rate_limit_redis(fake)

    storage = MemoryStorage()
    storage.reset()
    rate_limit_module.limiter.enabled = True
    rate_limit_module.limiter._storage = storage
    rate_limit_module.limiter._limiter = STRATEGIES[
        rate_limit_module.limiter._strategy or "fixed-window"
    ](storage)
    rate_limit_module.limiter._storage_dead = False

    ip_state = {"ip": "10.0.0.50"}

    def fake_client_ip(_request):
        return ip_state["ip"]

    monkeypatch.setattr(rate_limit_module, "get_client_ip", fake_client_ip)

    yield fake, ip_state

    fake.flushall()
    rate_limit_module.limiter._storage.reset()
    reset_rate_limit_redis(None)


def test_password_reset_rate_limit_by_email(
    client,
    db_session,
    isolated_rate_limit_redis,
    capture_reset_email,
):
    register_member(client)
    set_member_approved(db_session)

    for _ in range(settings.RATE_LIMIT_PASSWORD_RESET_EMAIL_MAX):
        response = _request_reset(client)
        assert response.status_code == 200

    blocked = _request_reset(client)
    assert blocked.status_code == 429
    assert blocked.json()["detail"]
