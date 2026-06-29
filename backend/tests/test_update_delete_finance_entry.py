import pytest

from conftest import (
    auth_header,
    create_treasurer_member,
    register_member,
    set_member_approved,
)


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
def treasurer_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_treasurer_member(db_session)
    return auth_header(client, email="treasurer@semo.edu")


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


def _create_entry(client, headers, **overrides):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_treasurer_can_update_entry(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "80.00", "description": "Updated snacks", "category": "supplies"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == "80.00"
    assert body["description"] == "Updated snacks"
    assert body["category"] == "supplies"
    assert body["entry_type"] == "expense"


def test_partial_update_only_changes_provided_fields(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "12.34"},
        headers=treasurer_member_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == "12.34"
    assert body["category"] == "food_beverage"
    assert body["description"] == "Snacks"


def test_treasurer_can_delete_entry(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.delete(
        f"/api/v1/finance/{entry['id']}",
        headers=treasurer_member_headers,
    )
    assert response.status_code == 204

    listed = client.get("/api/v1/finance", headers=treasurer_member_headers)
    assert listed.status_code == 200
    assert all(item["id"] != entry["id"] for item in listed.json()["entries"])


def test_update_missing_entry_returns_404(client, treasurer_member_headers):
    response = client.patch(
        "/api/v1/finance/9999",
        json={"amount": "10.00"},
        headers=treasurer_member_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Finance entry not found"


def test_delete_missing_entry_returns_404(client, treasurer_member_headers):
    response = client.delete(
        "/api/v1/finance/9999",
        headers=treasurer_member_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Finance entry not found"


def test_update_rejects_unknown_event(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"event_id": 999},
        headers=treasurer_member_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"


def test_general_member_cannot_update_or_delete(client, general_member_headers):
    update = client.patch(
        "/api/v1/finance/1",
        json={"amount": "10.00"},
        headers=general_member_headers,
    )
    assert update.status_code == 403

    delete = client.delete("/api/v1/finance/1", headers=general_member_headers)
    assert delete.status_code == 403
