"""Unit tests for production config checks."""

import pytest

from app.core.config import Settings, cors_allow_origins, docs_enabled
from app.core.production_checks import (
    enforce_production_config,
    production_config_fatal_issues,
    production_config_issues,
    production_config_warnings,
)


def test_production_config_issues_empty_in_development():
    settings = Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        SECRET_KEY="dev-only-secret-change-me-before-production-deploy",
    )
    assert production_config_issues(settings) == []


def test_production_config_flags_insecure_defaults():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="dev-only-secret-change-me-before-production-deploy",
        FRONTEND_URL="http://localhost:5173",
        EMAIL_ENABLED=False,
        EMAIL_TEST_OVERRIDE_RECIPIENT="dev@example.com",
        SKIP_EMAIL_VERIFICATION=True,
        ORG_OWNER_EMAILS="",
        CLOUDINARY_CLOUD_NAME="",
        RESEND_API_KEY="",
    )
    issues = production_config_issues(settings)
    assert any("DEBUG" in issue for issue in issues)
    assert any("SECRET_KEY" in issue for issue in issues)
    assert any("FRONTEND_URL" in issue for issue in issues)
    assert any("EMAIL_TEST_OVERRIDE" in issue for issue in issues)
    assert any("SKIP_EMAIL_VERIFICATION" in issue for issue in issues)
    assert any("ORG_OWNER_EMAILS" in issue for issue in issues)
    assert any("RESEND_API_KEY" in issue for issue in issues)
    assert any("DATABASE_URL" in issue for issue in issues)
    assert any("REDIS_URL" in issue for issue in issues)
    assert any("RESEND_FROM_EMAIL" in issue for issue in issues)


def test_production_config_warns_when_proxy_headers_disabled():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-sufficiently-long-production-secret-key",
        FRONTEND_URL="https://connect.example.edu",
        EMAIL_ENABLED=True,
        RESEND_API_KEY="re_live_test",
        RESEND_FROM_EMAIL="NSA Connect <mail@semo.edu>",
        ORG_OWNER_EMAILS="owner@example.com",
        CLOUDINARY_CLOUD_NAME="nsa-connect",
        DATABASE_URL="postgresql://app:secret@db.internal:5432/nsa_connect",
        REDIS_URL="redis://redis.internal:6379/0",
        RATE_LIMIT_TRUST_PROXY_HEADERS=False,
    )
    warnings = production_config_warnings(settings)
    assert any("RATE_LIMIT_TRUST_PROXY_HEADERS" in issue for issue in warnings)


def test_enforce_production_config_raises_on_fatal_issues():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="short",
        FRONTEND_URL="http://localhost:5173",
        EMAIL_ENABLED=False,
        RESEND_API_KEY="",
        ORG_OWNER_EMAILS="",
        CLOUDINARY_CLOUD_NAME="",
    )
    assert production_config_fatal_issues(settings)
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        enforce_production_config(settings)


def test_enforce_production_config_passes_secure_settings():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-sufficiently-long-production-secret-key",
        FRONTEND_URL="https://connect.example.edu",
        EMAIL_ENABLED=True,
        RESEND_API_KEY="re_live_test",
        RESEND_FROM_EMAIL="NSA Connect <mail@semo.edu>",
        ORG_OWNER_EMAILS="owner@example.com",
        CLOUDINARY_CLOUD_NAME="nsa-connect",
        DATABASE_URL="postgresql://app:secret@db.internal:5432/nsa_connect",
        REDIS_URL="redis://redis.internal:6379/0",
        SKIP_EMAIL_VERIFICATION=False,
        EMAIL_TEST_OVERRIDE_RECIPIENT="",
        RATE_LIMIT_TRUST_PROXY_HEADERS=True,
    )
    assert production_config_fatal_issues(settings) == []
    enforce_production_config(settings)


def test_docs_disabled_in_production():
    assert docs_enabled(Settings(ENVIRONMENT="development")) is True
    assert docs_enabled(Settings(ENVIRONMENT="production")) is False


def test_cors_allow_origins_includes_frontend_and_local_in_development():
    origins = cors_allow_origins(
        Settings(
            ENVIRONMENT="development",
            FRONTEND_URL="http://localhost:5173",
        )
    )
    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins


def test_cors_allow_origins_production_is_frontend_only():
    origins = cors_allow_origins(
        Settings(
            ENVIRONMENT="production",
            FRONTEND_URL="https://connect.example.edu",
        )
    )
    assert origins == ["https://connect.example.edu"]
