"""Unit tests for production config checks."""

from app.core.config import Settings
from app.core.production_checks import production_config_issues


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
    )
    issues = production_config_issues(settings)
    assert any("DEBUG" in issue for issue in issues)
    assert any("SECRET_KEY" in issue for issue in issues)
    assert any("FRONTEND_URL" in issue for issue in issues)
    assert any("EMAIL_TEST_OVERRIDE" in issue for issue in issues)
    assert any("SKIP_EMAIL_VERIFICATION" in issue for issue in issues)
    assert any("ORG_OWNER_EMAILS" in issue for issue in issues)
