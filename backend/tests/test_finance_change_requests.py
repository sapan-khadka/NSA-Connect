import pytest

from conftest import (
    auth_header,
    create_president_member,
    create_treasurer_member,
    register_member,
)

TREASURER_REQUIRED = "Requires treasurer role or higher"


def _finance_payload(**overrides):
    payload = {
        "entry_type": "expense",
        "category": "food_beverage",
        "amount": "65.00",
        "description": "Snacks",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def treasurer_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def president_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


def _create_entry(client, headers, **overrides):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_treasurer_update_creates_pending_request(client, treasurer_headers):
    entry = _create_entry(client, treasurer_headers)

    response = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "80.00", "description": "Updated snacks"},
        headers=treasurer_headers,
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["action"] == "update"
    assert body["payload"]["amount"] == "80.00"

    listed = client.get("/api/v1/finance", headers=treasurer_headers)
    assert listed.json()["entries"][0]["amount"] == "65.00"


def test_president_approves_treasurer_update(client, treasurer_headers, president_headers):
    entry = _create_entry(client, treasurer_headers)
    submitted = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "80.00"},
        headers=treasurer_headers,
    ).json()

    pending = client.get(
        "/api/v1/finance/change-requests/pending",
        headers=president_headers,
    )
    assert pending.status_code == 200
    assert pending.json()["total"] == 1

    approved = client.post(
        f"/api/v1/finance/change-requests/{submitted['id']}/approve",
        headers=president_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    listed = client.get("/api/v1/finance", headers=treasurer_headers)
    assert listed.json()["entries"][0]["amount"] == "80.00"


def test_treasurer_approves_president_delete(client, treasurer_headers, president_headers):
    entry = _create_entry(client, president_headers)
    submitted = client.delete(
        f"/api/v1/finance/{entry['id']}",
        headers=president_headers,
    )
    assert submitted.status_code == 202

    pending = client.get(
        "/api/v1/finance/change-requests/pending",
        headers=treasurer_headers,
    )
    assert pending.json()["total"] == 1

    approved = client.post(
        f"/api/v1/finance/change-requests/{submitted.json()['id']}/approve",
        headers=treasurer_headers,
    )
    assert approved.status_code == 200

    listed = client.get("/api/v1/finance", headers=treasurer_headers)
    assert all(item["id"] != entry["id"] for item in listed.json()["entries"])


def test_requester_cannot_approve_own_request(client, treasurer_headers):
    entry = _create_entry(client, treasurer_headers)
    submitted = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "80.00"},
        headers=treasurer_headers,
    ).json()

    response = client.post(
        f"/api/v1/finance/change-requests/{submitted['id']}/approve",
        headers=treasurer_headers,
    )
    assert response.status_code == 403


def test_update_missing_entry_returns_404(client, treasurer_headers):
    response = client.patch(
        "/api/v1/finance/9999",
        json={"amount": "10.00"},
        headers=treasurer_headers,
    )
    assert response.status_code == 404
