import pytest
from conftest import (
    auth_header,
    create_president_member,
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
def president_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_president_member(db_session)
    return auth_header(client, email="president@semo.edu")


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


def test_treasurer_update_submits_change_request(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={
            "amount": "80.00",
            "description": "Updated snacks",
            "category": "supplies",
        },
        headers=treasurer_member_headers,
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["action"] == "update"
    assert body["payload"]["amount"] == "80.00"


def test_treasurer_delete_submits_change_request(client, treasurer_member_headers):
    entry = _create_entry(client, treasurer_member_headers)

    response = client.delete(
        f"/api/v1/finance/{entry['id']}",
        headers=treasurer_member_headers,
    )
    assert response.status_code == 202
    assert response.json()["action"] == "delete"


def test_president_approves_treasurer_update(
    client,
    treasurer_member_headers,
    president_member_headers,
):
    entry = _create_entry(client, treasurer_member_headers)
    request = client.patch(
        f"/api/v1/finance/{entry['id']}",
        json={"amount": "12.34"},
        headers=treasurer_member_headers,
    ).json()

    approve = client.post(
        f"/api/v1/finance/change-requests/{request['id']}/approve",
        headers=president_member_headers,
    )
    assert approve.status_code == 200

    listed = client.get("/api/v1/finance", headers=treasurer_member_headers)
    assert listed.json()["entries"][0]["amount"] == "12.34"


def test_update_missing_entry_returns_404(client, treasurer_member_headers):
    response = client.patch(
        "/api/v1/finance/9999",
        json={"amount": "10.00"},
        headers=treasurer_member_headers,
    )
    assert response.status_code == 404


def test_delete_missing_entry_returns_404(client, treasurer_member_headers):
    response = client.delete(
        "/api/v1/finance/9999",
        headers=treasurer_member_headers,
    )
    assert response.status_code == 404


def test_general_member_cannot_update_or_delete(client, general_member_headers):
    update = client.patch(
        "/api/v1/finance/1",
        json={"amount": "10.00"},
        headers=general_member_headers,
    )
    assert update.status_code == 403

    delete = client.delete("/api/v1/finance/1", headers=general_member_headers)
    assert delete.status_code == 403
