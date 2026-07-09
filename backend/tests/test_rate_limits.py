"""Rate limiting tests."""

import pytest
from conftest import (
    auth_header,
    create_board_member,
    login_member,
    register_payload,
    set_member_approved,
)
from fastapi.testclient import TestClient

from app.core import rate_limit as rate_limit_module
from app.core.config import settings
from app.core.rate_limit import (
    RATE_LIMIT_LOGIN_MESSAGE,
    AppRateLimitExceeded,
    check_login_account_failures,
    clear_login_failures,
    get_rate_limit_redis,
    record_login_failure,
    reset_rate_limit_redis,
)


@pytest.fixture(autouse=True)
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

    ip_state = {"ip": "10.0.0.1"}

    def fake_client_ip(_request):
        return ip_state["ip"]

    monkeypatch.setattr(rate_limit_module, "get_client_ip", fake_client_ip)

    yield fake, ip_state

    fake.flushall()
    rate_limit_module.limiter._storage.reset()
    reset_rate_limit_redis(None)


def _failed_login(client: TestClient, email: str = "sapan@semo.edu"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "wrong-password"},
    )


def _register(client: TestClient, **kwargs):
    return client.post("/api/v1/auth/register", json=register_payload(**kwargs))


def _create_open_event(db_session, board_member):
    from datetime import UTC, datetime, timedelta

    from app.models.event import Event, EventType

    now = datetime.now(UTC)
    event = Event(
        title="Check-in Event",
        description="Open check-in window",
        event_type=EventType.SOCIAL,
        starts_at=now - timedelta(minutes=30),
        ends_at=now + timedelta(hours=2),
        location="Student Center",
        budget=0,
        created_by_id=board_member.id,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def test_login_ip_limit_returns_429_on_eleventh_attempt(
    client, db_session, isolated_rate_limit_redis
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.0.10"

    _register(client)
    set_member_approved(db_session)

    for _ in range(settings.RATE_LIMIT_LOGIN_IP_MAX):
        response = _failed_login(client)
        assert response.status_code == 401

    blocked = _failed_login(client)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == RATE_LIMIT_LOGIN_MESSAGE


def test_login_account_failure_returns_429(
    client, db_session, isolated_rate_limit_redis
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.0.11"

    _register(client)
    set_member_approved(db_session)
    email = "sapan@semo.edu"

    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_MAX):
        record_login_failure(email)

    blocked = _failed_login(client, email=email)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == RATE_LIMIT_LOGIN_MESSAGE


def test_successful_login_clears_account_failure_counter(
    client, db_session, isolated_rate_limit_redis
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.0.12"

    _register(client)
    set_member_approved(db_session)
    email = "sapan@semo.edu"

    for _ in range(5):
        record_login_failure(email)

    success = login_member(client, email=email, password="securepass123")
    assert success.status_code == 200

    redis_client = get_rate_limit_redis()
    assert int(redis_client.get(f"rl:login:fail:{email}") or 0) == 0


def test_clear_login_failures_resets_counter():
    email = "reset@semo.edu"
    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_MAX):
        record_login_failure(email)

    with pytest.raises(AppRateLimitExceeded):
        check_login_account_failures(email)

    clear_login_failures(email)
    check_login_account_failures(email)


def test_account_login_failures_do_not_block_other_accounts(
    client,
    db_session,
    isolated_rate_limit_redis,
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.0.13"

    _register(client, email="first@semo.edu", student_id="11111111")
    _register(client, email="second@semo.edu", student_id="22222222")
    set_member_approved(db_session, email="first@semo.edu")
    set_member_approved(db_session, email="second@semo.edu")

    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_FAILURES_MAX):
        record_login_failure("first@semo.edu")

    blocked = _failed_login(client, email="first@semo.edu")
    assert blocked.status_code == 429

    other = _failed_login(client, email="second@semo.edu")
    assert other.status_code == 401


def test_registration_limit_triggers(client, isolated_rate_limit_redis):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.1.1"

    for index in range(settings.RATE_LIMIT_REGISTER_IP_MAX):
        response = _register(
            client,
            email=f"user{index}@semo.edu",
            student_id=f"{10000000 + index}",
        )
        assert response.status_code == 201

    blocked = _register(
        client,
        email="blocked@semo.edu",
        student_id="99999999",
    )
    assert blocked.status_code == 429


def test_guest_checkin_event_limit_triggers(
    client, db_session, isolated_rate_limit_redis
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.2.1"

    board = create_board_member(db_session)
    from app.services.event_checkin_service import ensure_checkin_token

    event = _create_open_event(db_session, board)
    token = ensure_checkin_token(db_session, event)

    for index in range(settings.RATE_LIMIT_GUEST_CHECKIN_EVENT_IP_MAX):
        response = client.post(
            f"/api/v1/events/{event.id}/checkin/guest",
            json={
                "token": token,
                "guest_name": f"Guest {index}",
            },
        )
        assert response.status_code == 200

    blocked = client.post(
        f"/api/v1/events/{event.id}/checkin/guest",
        json={
            "token": token,
            "guest_name": "One Too Many",
        },
    )
    assert blocked.status_code == 429


def test_normal_authenticated_browsing_stays_below_global_limit(
    client,
    db_session,
    isolated_rate_limit_redis,
):
    _, ip_state = isolated_rate_limit_redis
    ip_state["ip"] = "10.0.3.1"

    _register(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    for _ in range(50):
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
