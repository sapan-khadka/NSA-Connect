"""Automated authorization matrix tests — permanent guard against auth regressions."""

from __future__ import annotations

import json

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from fastapi.routing import APIRoute
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import engine, get_db
from app.main import app as fastapi_app
from app.models.base import Base
from app.models.member import Member, MemberRole, MemberStatus, ProfileFieldVisibility
from app.models.preptask import PrepTaskGroup, PrepTaskGroupItem
from app.services.ai_chat_tools import execute_chat_tool
from authorization_matrix import (
    ENDPOINT_AUTH_RULES,
    MEMBER_REQUIRED_PATHS,
    PUBLIC_PATHS,
    RESTRICTED_ENDPOINT_RULES,
    RESTRICTED_MIN_ROLES,
)
from authorization_probe_support import (
    build_probe_context,
    probe_request_kwargs,
    resolve_probe_path,
)
from conftest import (
    VALID_EMAIL,
    VALID_GRADUATION_YEAR,
    VALID_MAJOR,
    VALID_PASSWORD,
    auth_header,
    create_board_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)

BOARD_REQUIRED_DETAIL = "Requires board role or higher"
TREASURER_REQUIRED_DETAIL = "Requires treasurer role or higher"
PRESIDENT_REQUIRED_DETAIL = "Requires president role or higher"
MEETING_MANAGER_REQUIRED_DETAIL = "Requires secretary, vice president, or president"
TASK_MANAGER_REQUIRED_DETAIL = "Requires president, vice president, or event manager"
TASK_OVERSIGHT_REQUIRED_DETAIL = "Requires president or vice president"

GENERAL_MEMBER_FORBIDDEN_DETAIL = {
    "board": BOARD_REQUIRED_DETAIL,
    "treasurer": TREASURER_REQUIRED_DETAIL,
    "president": PRESIDENT_REQUIRED_DETAIL,
    "meeting_manager": MEETING_MANAGER_REQUIRED_DETAIL,
    "task_manager": TASK_MANAGER_REQUIRED_DETAIL,
    "task_oversight": TASK_OVERSIGHT_REQUIRED_DETAIL,
}

INSUFFICIENT_ROLE_ACTOR = {
    "treasurer": TREASURER_REQUIRED_DETAIL,
    "president": PRESIDENT_REQUIRED_DETAIL,
    "meeting_manager": MEETING_MANAGER_REQUIRED_DETAIL,
    "task_manager": TASK_MANAGER_REQUIRED_DETAIL,
    "task_oversight": TASK_OVERSIGHT_REQUIRED_DETAIL,
}


def _collect_live_routes() -> set[tuple[str, str]]:
    routes: set[tuple[str, str]] = set()

    def walk(router, prefix: str = "") -> None:
        for route in getattr(router, "routes", []):
            if isinstance(route, APIRoute):
                full_path = (prefix + route.path).replace("//", "/") or "/"
                for method in route.methods:
                    if method in {"HEAD", "OPTIONS"}:
                        continue
                    routes.add((method.upper(), full_path))
                continue

            if hasattr(route, "original_router"):
                include_prefix = ""
                if hasattr(route, "include_context"):
                    include_prefix = route.include_context.prefix or ""
                walk(
                    route.original_router,
                    (prefix + include_prefix).replace("//", "/"),
                )
            elif hasattr(route, "path") and hasattr(route, "routes"):
                child_prefix = (prefix + (route.path or "")).replace("//", "/")
                walk(route, child_prefix)

    walk(fastapi_app.router)
    return routes


def _matrix_routes() -> set[tuple[str, str]]:
    return {(rule.method.upper(), rule.path) for rule in ENDPOINT_AUTH_RULES}


def _request(test_client, rule, headers, probe_context):
    path = resolve_probe_path(rule.path, probe_context)
    return test_client.request(
        rule.method,
        path,
        headers=headers,
        **probe_request_kwargs(rule.method, rule.path),
    )


@pytest.fixture(scope="module")
def auth_matrix_db() -> Session:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    import app.models.password_reset_token  # noqa: F401
    session = sessionmaker(bind=test_engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@pytest.fixture(scope="module")
def auth_matrix_client(auth_matrix_db: Session):
    def override_get_db():
        try:
            yield auth_matrix_db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    mock_connection = MagicMock()
    mock_connection.execute = MagicMock()

    with (
        patch.object(
            engine,
            "connect",
            return_value=MagicMock(
                __enter__=MagicMock(return_value=mock_connection),
                __exit__=MagicMock(return_value=False),
            ),
        ),
        patch.object(engine, "dispose"),
        patch(
            "app.services.notification_email_service.send_resend_email",
            return_value="test-email-id",
        ),
        patch(
            "app.integrations.resend_client.send_email",
            return_value="test-email-id",
        ),
        patch("celery.app.task.Task.delay"),
        patch("celery.app.task.Task.apply_async"),
        TestClient(fastapi_app) as test_client,
    ):
        yield test_client

    fastapi_app.dependency_overrides.clear()


def _create_approved_general_member(db_session: Session) -> Member:
    from app.core.security import hash_password

    member = Member(
        full_name="Sapan Khadka",
        email=VALID_EMAIL,
        student_id="12345678",
        major=VALID_MAJOR,
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(VALID_PASSWORD),
        role=MemberRole.GENERAL,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


@pytest.fixture(scope="module")
def general_member_headers(auth_matrix_client, auth_matrix_db):
    _create_approved_general_member(auth_matrix_db)
    return auth_header(auth_matrix_client)


@pytest.fixture(scope="module")
def board_member_headers(auth_matrix_client, auth_matrix_db):
    create_board_member(auth_matrix_db)
    return auth_header(auth_matrix_client, email="board@semo.edu")


@pytest.fixture(scope="module")
def treasurer_member_headers(auth_matrix_client, auth_matrix_db):
    create_treasurer_member(auth_matrix_db)
    return auth_header(auth_matrix_client, email="treasurer@semo.edu")


@pytest.fixture(scope="module")
def probe_context(
    auth_matrix_client,
    auth_matrix_db,
    general_member_headers,
    board_member_headers,
    treasurer_member_headers,
):
    general = auth_matrix_db.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    assert general is not None, "general_member_headers must register sapan@semo.edu"
    return build_probe_context(
        auth_matrix_client,
        auth_matrix_db,
        board_headers=board_member_headers,
        treasurer_headers=treasurer_member_headers,
        general_member=general,
    )


@pytest.fixture
def general_member_headers_fn(client, db_session):
    """Function-scoped headers for object-level IDOR tests."""
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers_fn(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


def test_matrix_covers_all_live_api_routes():
    live = _collect_live_routes()
    documented = _matrix_routes()

    undocumented = sorted(live - documented)
    stale = sorted(documented - live)

    assert not undocumented, (
        "API routes missing from authorization_matrix.py:\n"
        + "\n".join(f"  {method} {path}" for method, path in undocumented)
    )
    assert not stale, (
        "Stale entries in authorization_matrix.py (route no longer exists):\n"
        + "\n".join(f"  {method} {path}" for method, path in stale)
    )


def test_no_restricted_endpoints_marked_skip_probe():
    skipped = [
        rule
        for rule in ENDPOINT_AUTH_RULES
        if rule.min_role in RESTRICTED_MIN_ROLES and rule.skip_role_probe
    ]
    assert not skipped, (
        "Restricted endpoints must be probed in CI — remove skip_role_probe:\n"
        + "\n".join(f"  {rule.method} {rule.path}" for rule in skipped)
    )


def test_all_restricted_endpoints_have_probe_definitions():
    assert len(RESTRICTED_ENDPOINT_RULES) == 68


@pytest.mark.parametrize(
    "rule",
    RESTRICTED_ENDPOINT_RULES,
    ids=lambda rule: f"{rule.method} {rule.path}",
)
def test_restricted_endpoints_reject_unauthenticated(auth_matrix_client, probe_context, rule):
    response = _request(auth_matrix_client, rule, headers=None, probe_context=probe_context)
    assert response.status_code == 401, (
        f"{rule.method} {rule.path} should require authentication"
    )


@pytest.mark.parametrize(
    "rule",
    RESTRICTED_ENDPOINT_RULES,
    ids=lambda rule: f"{rule.method} {rule.path}",
)
def test_restricted_endpoints_reject_general_member(
    auth_matrix_client,
    probe_context,
    general_member_headers,
    rule,
):
    response = _request(
        auth_matrix_client,
        rule,
        headers=general_member_headers,
        probe_context=probe_context,
    )
    assert response.status_code == 403, (
        f"{rule.method} {rule.path} should reject general members"
    )
    assert response.json()["detail"] == GENERAL_MEMBER_FORBIDDEN_DETAIL[rule.min_role]


@pytest.mark.parametrize(
    "rule",
    [r for r in RESTRICTED_ENDPOINT_RULES if r.min_role in INSUFFICIENT_ROLE_ACTOR],
    ids=lambda rule: f"{rule.method} {rule.path}",
)
def test_restricted_endpoints_reject_insufficient_board_member(
    auth_matrix_client,
    probe_context,
    board_member_headers,
    rule,
):
    response = _request(
        auth_matrix_client,
        rule,
        headers=board_member_headers,
        probe_context=probe_context,
    )
    assert response.status_code == 403, (
        f"{rule.method} {rule.path} should reject board-only callers"
    )
    assert response.json()["detail"] == INSUFFICIENT_ROLE_ACTOR[rule.min_role]


@pytest.mark.parametrize("method,path", MEMBER_REQUIRED_PATHS)
def test_member_endpoints_reject_unauthenticated(client, method, path):
    response = client.request(method, path)
    assert response.status_code == 401, f"{method} {path} should require auth"


@pytest.mark.parametrize("method,path", PUBLIC_PATHS)
def test_public_endpoints_allow_unauthenticated_get(client, method, path):
    if method != "GET":
        pytest.skip("Only safe GET public probes here")
    response = client.request(method, path)
    assert response.status_code in {200, 422}, f"{method} {path} should be public"


def _closed_meeting_payload(**overrides):
    payload = {
        "name": "Closed Board Session",
        "starts_at": "2030-08-01T18:00:00+00:00",
        "event_type": "meeting",
        "description": "Board only.",
        "budget": "0.00",
        "meeting_visibility": "board_only",
    }
    payload.update(overrides)
    return payload


def test_general_member_cannot_access_closed_meeting_photos(
    client,
    board_member_headers_fn,
    general_member_headers_fn,
):
    create = client.post(
        "/api/v1/events",
        json=_closed_meeting_payload(),
        headers=board_member_headers_fn,
    )
    event_id = create.json()["id"]

    list_response = client.get(
        f"/api/v1/events/{event_id}/photos",
        headers=general_member_headers_fn,
    )
    assert list_response.status_code == 404

    download_response = client.post(
        f"/api/v1/events/{event_id}/photos/download",
        headers=general_member_headers_fn,
    )
    assert download_response.status_code == 404


def test_general_member_cannot_sign_up_for_slot_on_closed_meeting(
    client,
    board_member_headers_fn,
    general_member_headers_fn,
):
    create = client.post(
        "/api/v1/events",
        json=_closed_meeting_payload(),
        headers=board_member_headers_fn,
    )
    event_id = create.json()["id"]

    slot_response = client.post(
        f"/api/v1/events/{event_id}/slots",
        json={"task_name": "Setup", "max_signup_count": 5},
        headers=board_member_headers_fn,
    )
    slot_id = slot_response.json()["id"]

    signup = client.post(
        f"/api/v1/slots/{slot_id}/signup",
        headers=general_member_headers_fn,
    )
    assert signup.status_code == 404


def test_general_member_cannot_view_other_members_board_only_contact_fields(
    client,
    db_session,
):
    register_member(client)
    set_member_approved(db_session)
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))
    member.phone = "555-0100"
    member.phone_visibility = ProfileFieldVisibility.BOARD_ONLY
    db_session.commit()

    register_member(client, email="peer@semo.edu", student_id="44444444")
    set_member_approved(db_session, email="peer@semo.edu")

    response = client.get(
        f"/api/v1/members/{member.id}",
        headers=auth_header(client, email="peer@semo.edu"),
    )
    assert response.status_code == 200
    assert response.json()["phone"] is None


def test_general_member_cannot_update_another_members_task(
    client,
    db_session,
    board_member_headers_fn,
    general_member_headers_fn,
):
    event_response = client.post(
        "/api/v1/events",
        json={
            "name": "Open Event",
            "starts_at": "2030-06-01T18:00:00+00:00",
            "event_type": "cultural",
            "description": "Public event",
            "budget": "100.00",
        },
        headers=board_member_headers_fn,
    )
    event_id = event_response.json()["id"]

    group = PrepTaskGroup(group_name="Setup")
    group.items = [PrepTaskGroupItem(label="Reserve room", sort_order=0)]
    db_session.add(group)
    db_session.commit()

    task_response = client.post(
        f"/api/v1/events/{event_id}/tasks",
        json={
            "group_name": "Setup",
            "due_date": "2030-05-20T12:00:00+00:00",
        },
        headers=board_member_headers_fn,
    )
    task_id = task_response.json()["id"]

    patch = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"is_complete": True},
        headers=general_member_headers_fn,
    )
    assert patch.status_code == 403


def test_ai_finance_tool_denied_for_general_member(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    member = db_session.scalar(select(Member).where(Member.email == "sapan@semo.edu"))

    result = execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="get_finance_summary",
        tool_input={},
    )
    assert "permission_denied" in result


def test_ai_closed_meeting_hidden_from_general_member_search(
    client,
    db_session,
    board_member_headers_fn,
):
    register_member(client, email="viewer@semo.edu", student_id="55555555")
    set_member_approved(db_session, email="viewer@semo.edu")

    client.post(
        "/api/v1/events",
        json=_closed_meeting_payload(),
        headers=board_member_headers_fn,
    )

    member = db_session.scalar(select(Member).where(Member.email == "viewer@semo.edu"))

    result = execute_chat_tool(
        db=db_session,
        member=member,
        tool_name="search_events",
        tool_input={"keyword": "Closed Board"},
    )
    events = json.loads(result)
    assert events == []
