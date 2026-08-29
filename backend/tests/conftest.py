from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models.custom_board_position  # noqa: F401 — register table for create_all
import app.models.discussion_message_reaction  # noqa: F401 — register table for create_all
import app.models.discussion_read_state  # noqa: F401 — register table for create_all
import app.models.discussion_room_pin  # noqa: F401 — register table for create_all
import app.models.discussion_room_read  # noqa: F401 — register table for create_all
import app.models.event_suggestion_comment  # noqa: F401 — register table for create_all
import app.models.event_suggestion_interest  # noqa: F401 — register table for create_all
import app.models.event_suggestion_poll  # noqa: F401 — register table for create_all
import app.models.event_suggestion_view  # noqa: F401 — register table for create_all
import app.models.member_document  # noqa: F401 — register table for create_all
import app.models.personal_note  # noqa: F401 — register table for create_all
import app.models.org_document  # noqa: F401 — register table for create_all
import app.models.organization  # noqa: F401 — register table for create_all
import app.models.organization_membership  # noqa: F401 — register table for create_all
import app.models.password_reset_token  # noqa: F401 — register table for create_all
import app.models.university  # noqa: F401 — register table for create_all
from app.core.config import settings
from app.core.database import engine, get_db
from app.main import app
from app.models.base import Base
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.services.organization_context import (
    ensure_default_university_and_org,
    ensure_membership_for_member,
    get_default_university_id,
    sync_membership_from_member,
)

VALID_PASSWORD = "securepass123"
VALID_EMAIL = "sapan@semo.edu"
VALID_STUDENT_ID = "12345678"
VALID_MAJOR = "Computer Science"
VALID_GRADUATION_YEAR = 2028
BAD_DOMAIN_EMAIL = "sapan@gmail.com"


def _test_settings(base_settings):
    return base_settings.model_copy(
        update={
            "DEBUG": False,
            "CLOUDINARY_CLOUD_NAME": "test-cloud",
            "CLOUDINARY_API_KEY": "test-key",
            "CLOUDINARY_API_SECRET": "test-secret",
            "AI_ENABLED": False,
            "OPENAI_API_KEY": "test-openai-key",
            # Do not inherit developer .env allowlist into suite defaults.
            "ORG_OWNER_EMAILS": "",
            "SKIP_EMAIL_VERIFICATION": False,
            "RESEND_API_KEY": "",
            "EMAIL_TEST_OVERRIDE_RECIPIENT": "",
        }
    )


@pytest.fixture(autouse=True)
def reset_settings_cache(monkeypatch, request):
    """Keep module-level settings and get_settings() in sync across tests."""
    if request.node.name == "test_settings_from_env":
        yield
        return

    import app.core.config as config_module
    from app.integrations.openai_client import reset_openai_client

    config_module.get_settings.cache_clear()
    reset_openai_client()
    test_settings = _test_settings(config_module.get_settings())
    config_module.settings = test_settings

    for module_path in (
        "app.services.receipt_upload_service",
        "app.services.event_photo_upload_service",
        "app.services.event_photo_service",
        "app.services.local_event_photo_storage",
        "app.services.local_avatar_storage",
        "app.services.avatar_upload_service",
        "app.services.member_document_service",
        "app.services.email_service",
        "app.services.email_verification_service",
        "app.services.resend_email_service",
        "app.services.password_reset_service",
        "app.api.v1.notifications",
        "app.services.constitution_ingest_service",
        "app.services.constitution_search_service",
    ):
        monkeypatch.setattr(f"{module_path}.settings", test_settings)

    monkeypatch.setattr(config_module, "get_settings", lambda: test_settings)
    monkeypatch.setattr(
        "app.services.embedding_service.get_settings",
        lambda: test_settings,
    )
    monkeypatch.setattr(
        "app.integrations.openai_client.get_settings",
        lambda: test_settings,
    )
    monkeypatch.setattr(app, "debug", test_settings.DEBUG)
    yield


@pytest.fixture(autouse=True)
def disable_first_owner_bootstrap(monkeypatch, request):
    """Keep register() from promoting the first test user to president.

    Production still bootstraps an empty org. Tests that need that behavior
    should mark `@pytest.mark.empty_org`.
    """
    if request.node.get_closest_marker("empty_org") is not None:
        return

    monkeypatch.setattr(
        "app.services.organization_context.bootstrap_first_org_owner",
        lambda db, member: False,
    )


@pytest.fixture(scope="session", autouse=True)
def use_fake_rate_limit_backends():
    """Session-wide in-memory rate-limit backends (CI has no Redis).

    Must be session-scoped: module-scoped fixtures (e.g. auth matrix login)
    run before function-scoped autouse fixtures and still hit Redis otherwise.
    """
    try:
        import fakeredis
    except ImportError as exc:
        pytest.skip(f"fakeredis required for tests: {exc}")

    from limits.storage import MemoryStorage
    from limits.strategies import STRATEGIES

    from app.core import rate_limit as rate_limit_module
    from app.core.rate_limit import reset_rate_limit_redis

    fake = fakeredis.FakeRedis(decode_responses=True)
    reset_rate_limit_redis(fake)

    storage = MemoryStorage()
    rate_limit_module.limiter._storage = storage
    rate_limit_module.limiter._limiter = STRATEGIES[
        rate_limit_module.limiter._strategy or "fixed-window"
    ](storage)
    rate_limit_module.limiter._storage_dead = False

    yield fake
    reset_rate_limit_redis(None)


@pytest.fixture(autouse=True)
def block_external_integrations():
    """Never hit Celery brokers, Resend, Anthropic, or OpenAI during tests."""
    anthropic_sdk_client = MagicMock(name="anthropic_sdk_client")
    anthropic_sdk_client.messages.create.side_effect = AssertionError(
        "Real Anthropic API must not be called in tests; use mock_claude_checklist_api",
    )
    openai_sdk_client = MagicMock(name="openai_sdk_client")

    def fake_embeddings_create(**kwargs):
        inputs = kwargs["input"]
        if isinstance(inputs, str):
            inputs = [inputs]
        data = []
        for index, text in enumerate(inputs):
            seed = hash(text)
            vector = [float((seed + offset) % 1000) / 1000.0 for offset in range(1536)]
            data.append(MagicMock(embedding=vector, index=index))
        return MagicMock(data=data)

    openai_sdk_client.embeddings.create.side_effect = fake_embeddings_create

    with (
        patch(
            "anthropic.Anthropic", return_value=anthropic_sdk_client
        ) as anthropic_client,
        patch("openai.OpenAI", return_value=openai_sdk_client) as openai_client,
        patch("celery.app.task.Task.delay") as celery_delay,
        patch("celery.app.task.Task.apply_async") as celery_apply_async,
        patch("app.services.email_service.settings.EMAIL_ENABLED", False),
        patch(
            "resend.Emails.send",
            return_value={"id": "test-resend-id"},
        ) as resend_send,
        patch(
            "app.services.receipt_upload_service.upload_receipt"
        ) as cloudinary_upload_receipt,
    ):
        from app.integrations.cloudinary_client import CloudinaryUploadResult

        cloudinary_upload_receipt.return_value = CloudinaryUploadResult(
            receipt_url="https://res.cloudinary.com/test/image/upload/v1/receipt.jpg",
            public_id="nsa-connect/finance-receipts/receipt",
            bytes=128,
            format="jpg",
            resource_type="image",
        )
        yield {
            "anthropic_client": anthropic_client,
            "anthropic_sdk_client": anthropic_sdk_client,
            "openai_client": openai_client,
            "openai_sdk_client": openai_sdk_client,
            "celery_delay": celery_delay,
            "celery_apply_async": celery_apply_async,
            "cloudinary_upload_receipt": cloudinary_upload_receipt,
            "resend_send": resend_send,
        }


@pytest.fixture(autouse=True)
def disable_rate_limits_outside_rate_limit_tests(monkeypatch, request):
    if request.module.__name__.endswith("test_rate_limits"):
        return

    from app.core import rate_limit as rate_limit_module

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    rate_limit_module.limiter.enabled = False


@pytest.fixture
def mock_claude_chat_api():
    """Mock Claude for chat — no network, no API cost."""
    from tests.helpers.anthropic_mocks import mock_claude_chat_api as _mock_api

    with _mock_api() as mock_client:
        yield mock_client


@pytest.fixture
def mock_claude_checklist_api():
    """Mock Claude for checklist generation — no network, no API cost."""
    from tests.helpers.anthropic_mocks import mock_claude_checklist_api as _mock_api

    with _mock_api() as mock_client:
        yield mock_client


@pytest.fixture
def mock_claude_announcement_api():
    """Mock Claude for announcement drafts — no network, no API cost."""
    from tests.helpers.anthropic_mocks import mock_claude_announcement_api as _mock_api

    with _mock_api() as mock_client:
        yield mock_client


@pytest.fixture
def mock_claude_minutes_api():
    """Mock Claude for minutes summaries — no network, no API cost."""
    from tests.helpers.anthropic_mocks import mock_claude_minutes_api as _mock_api

    with _mock_api() as mock_client:
        yield mock_client


def register_payload(
    email=VALID_EMAIL,
    password=VALID_PASSWORD,
    student_id=VALID_STUDENT_ID,
):
    return {
        "full_name": "Sapan Khadka",
        "email": email,
        "password": password,
        "student_id": student_id,
        "major": VALID_MAJOR,
        "graduation_year": VALID_GRADUATION_YEAR,
    }


def register_member(
    client,
    email=VALID_EMAIL,
    password=VALID_PASSWORD,
    student_id=VALID_STUDENT_ID,
):
    return client.post(
        "/api/v1/auth/register",
        json=register_payload(
            email=email,
            password=password,
            student_id=student_id,
        ),
    )


def set_member_approved(db_session: Session, email=VALID_EMAIL):
    """Approve a registered member as a general member.

    First-user registration bootstraps an org owner/president. Tests that call
    this helper want a regular approved member, so reset role/position after
    approval.
    """
    from datetime import UTC, datetime

    member = db_session.scalar(select(Member).where(Member.email == email))
    member.status = MemberStatus.APPROVED
    member.role = MemberRole.GENERAL
    member.position = MemberPosition.MEMBER
    if member.email_verified_at is None:
        member.email_verified_at = datetime.now(UTC)
    sync_membership_from_member(db_session, member)
    db_session.commit()


def mark_email_verified(db_session: Session, email=VALID_EMAIL):
    """Mark a registered member's email as verified (test helper)."""
    from datetime import UTC, datetime

    member = db_session.scalar(select(Member).where(Member.email == email))
    assert member is not None
    if member.email_verified_at is None:
        member.email_verified_at = datetime.now(UTC)
        db_session.commit()


def create_board_member(
    db_session: Session,
    email="board@semo.edu",
    password=VALID_PASSWORD,
    student_id="87654321",
):
    from datetime import UTC, datetime

    from app.core.security import hash_password
    from app.models.member import MemberRole

    member = Member(
        full_name="Board Member",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.BOARD,
        status=MemberStatus.APPROVED,
        email_verified_at=datetime.now(UTC),
        university_id=get_default_university_id(db_session),
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    ensure_membership_for_member(db_session, member)
    return member


def create_vice_president_member(
    db_session: Session,
    email="vp@semo.edu",
    password=VALID_PASSWORD,
    student_id="76543210",
):
    from datetime import UTC, datetime

    from app.core.security import hash_password
    from app.models.member import MemberPosition, MemberRole

    member = Member(
        full_name="Vice President",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.BOARD,
        position=MemberPosition.VICE_PRESIDENT,
        status=MemberStatus.APPROVED,
        email_verified_at=datetime.now(UTC),
        university_id=get_default_university_id(db_session),
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    ensure_membership_for_member(db_session, member)
    return member


def create_president_member(
    db_session: Session,
    email="president@semo.edu",
    password=VALID_PASSWORD,
    student_id="99887766",
):
    from datetime import UTC, datetime

    from app.core.security import hash_password
    from app.models.member import MemberRole
    from app.services.organization_context import ensure_nsa_org_owner

    member = Member(
        full_name="President",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.PRESIDENT,
        status=MemberStatus.APPROVED,
        email_verified_at=datetime.now(UTC),
        university_id=get_default_university_id(db_session),
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    ensure_membership_for_member(db_session, member)
    ensure_nsa_org_owner(db_session)
    return member


def create_treasurer_member(
    db_session: Session,
    email="treasurer@semo.edu",
    password=VALID_PASSWORD,
    student_id="55443322",
):
    from datetime import UTC, datetime

    from app.core.security import hash_password
    from app.models.member import MemberRole

    member = Member(
        full_name="Treasurer",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.TREASURER,
        status=MemberStatus.APPROVED,
        email_verified_at=datetime.now(UTC),
        university_id=get_default_university_id(db_session),
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    ensure_membership_for_member(db_session, member)
    return member


def auth_header(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    response = login_member(client, email=email, password=password)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def login_member(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def _patch_engine_for_testclient():
    """Lifespan pings engine.connect(); tests use SQLite via dependency overrides."""
    mock_connection = MagicMock()
    mock_connection.execute = MagicMock()
    return (
        patch.object(
            engine,
            "connect",
            return_value=MagicMock(
                __enter__=MagicMock(return_value=mock_connection),
                __exit__=MagicMock(return_value=False),
            ),
        ),
        patch.object(engine, "dispose"),
    )


@pytest.fixture
def db_session() -> Session:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    session = sessionmaker(bind=test_engine)()

    # Every tenant-scoped table defaults `organization_id` to 1 (matching the
    # production migration's backfill), so seed the row it actually points to
    # — mirrors `ensure_default_university_and_org` running once in prod.
    ensure_default_university_and_org(session)

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_create_db_session():
        # Same shared test session; no-op close so the fixture owns lifecycle.
        class _SharedSessionProxy:
            def __getattr__(self, name: str):
                return getattr(db_session, name)

            def close(self) -> None:
                return None

        return _SharedSessionProxy()

    app.dependency_overrides[get_db] = override_get_db

    engine_connect_patch, engine_dispose_patch = _patch_engine_for_testclient()

    with (
        engine_connect_patch,
        engine_dispose_patch,
        patch(
            "app.core.database.create_db_session",
            side_effect=override_create_db_session,
        ),
        patch(
            "app.api.v1.discussion_ws.create_db_session",
            side_effect=override_create_db_session,
        ),
        TestClient(app) as test_client,
    ):
        yield test_client

    app.dependency_overrides.clear()
