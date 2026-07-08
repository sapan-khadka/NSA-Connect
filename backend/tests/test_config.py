from app.core.config import Settings, get_settings


def test_settings_defaults():
    settings = Settings()
    assert settings.APP_NAME == "NSA Connect API"
    assert settings.ENVIRONMENT == "development"
    assert settings.DATABASE_URL.startswith("postgresql://")
    assert settings.REDIS_URL.startswith("redis://")
    assert settings.is_development is True


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("APP_NAME", "Test API")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DEBUG", "false")

    get_settings.cache_clear()
    try:
        settings = get_settings()

        assert settings.APP_NAME == "Test API"
        assert settings.ENVIRONMENT == "production"
        assert settings.DEBUG is False
        assert settings.is_development is False
    finally:
        get_settings.cache_clear()
