from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.middleware.security_headers import API_SECURITY_HEADERS, HSTS_HEADER_VALUE

client = TestClient(app)


def test_api_responses_include_security_headers():
    response = client.get("/health")
    assert response.status_code == 200
    for name, value in API_SECURITY_HEADERS.items():
        assert response.headers.get(name) == value
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert "Strict-Transport-Security" not in response.headers


def test_hsts_set_for_https_outside_development():
    with (
        patch("app.middleware.security_headers.settings.ENVIRONMENT", "staging"),
        patch("app.middleware.security_headers.settings.HSTS_ENABLED", True),
    ):
        response = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert response.status_code == 200
    assert response.headers.get("Strict-Transport-Security") == HSTS_HEADER_VALUE
