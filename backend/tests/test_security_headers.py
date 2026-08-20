from fastapi.testclient import TestClient

from app.main import app
from app.middleware.security_headers import API_SECURITY_HEADERS

client = TestClient(app)


def test_api_responses_include_security_headers():
    response = client.get("/health")
    assert response.status_code == 200
    for name, value in API_SECURITY_HEADERS.items():
        assert response.headers.get(name) == value
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
