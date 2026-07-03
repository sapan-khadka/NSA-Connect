import pytest

from conftest import (
    auth_header,
    create_president_member,
    create_treasurer_member,
    register_member,
)


def _finance_payload(**overrides):
    payload = {
        "entry_type": "income",
        "category": "fundraising",
        "amount": "150.00",
        "description": "Bake sale proceeds",
        "receipt_url": "https://example.com/receipt.pdf",
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


def test_treasurer_can_log_income(client, treasurer_member_headers):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(),
        headers=treasurer_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["entry_type"] == "income"
    assert body["category"] == "fundraising"
    assert body["amount"] == "150.00"
    assert body["description"] == "Bake sale proceeds"
    assert body["receipt_url"] == "https://example.com/receipt.pdf"
    assert body["created_by_id"] == 2


def test_president_can_log_expense(client, president_member_headers):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(
            entry_type="expense",
            category="food_beverage",
            amount="75.50",
            description="Catering deposit",
            receipt_url=None,
        ),
        headers=president_member_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["entry_type"] == "expense"
    assert body["category"] == "food_beverage"
    assert body["amount"] == "75.50"
    assert body["receipt_url"] is None
    assert body["created_by_id"] == 2


def test_create_finance_entry_accepts_custom_category(
    client,
    treasurer_member_headers,
):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(
            entry_type="expense",
            category="Equipment Rental",
            amount="42.00",
            description="Speaker honorarium",
            receipt_url=None,
        ),
        headers=treasurer_member_headers,
    )

    assert response.status_code == 201
    assert response.json()["category"] == "equipment_rental"


def test_create_finance_entry_rejects_unknown_event(
    client,
    treasurer_member_headers,
):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(event_id=999),
        headers=treasurer_member_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"


@pytest.mark.parametrize(
    "field, value",
    [
        ("entry_type", "transfer"),
        ("category", ""),
        ("category", "a"),
        ("category", "9equipment"),
        ("amount", "0.00"),
        ("amount", "-10.00"),
    ],
)
def test_create_finance_entry_rejects_invalid_payload(
    client,
    treasurer_member_headers,
    field,
    value,
):
    response = client.post(
        "/api/v1/finance",
        json=_finance_payload(**{field: value}),
        headers=treasurer_member_headers,
    )

    assert response.status_code == 422
