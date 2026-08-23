from unittest.mock import patch

from conftest import auth_header, register_member, set_member_approved
from fastapi.testclient import TestClient

from app.core.rate_limit import RATE_LIMIT_AI_MESSAGE, AppRateLimitExceeded
from app.main import app

module_client = TestClient(app)


def test_ai_endpoints_enforce_usage_cap(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    headers = auth_header(client)

    with patch(
        "app.api.v1.ai.enforce_ai_user_limit",
        side_effect=AppRateLimitExceeded(RATE_LIMIT_AI_MESSAGE),
    ):
        response = client.post(
            "/api/v1/ai/chat",
            headers=headers,
            json={"message": "hello", "history": []},
        )
    assert response.status_code == 429
    assert response.json()["detail"] == RATE_LIMIT_AI_MESSAGE


def test_request_size_limit_rejects_oversized_content_length():
    with patch("app.middleware.request_size_limit.settings.MAX_REQUEST_BODY_BYTES", 100):
        response = module_client.post(
            "/api/v1/auth/login",
            headers={"Content-Length": "500"},
            content=b"x" * 20,
        )
    assert response.status_code == 413
    assert response.json()["detail"] == "Request body too large"
