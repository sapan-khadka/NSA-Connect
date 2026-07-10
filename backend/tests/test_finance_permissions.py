import pytest
from conftest import (
    auth_header,
    create_board_member,
    create_president_member,
    create_treasurer_member,
    register_member,
    set_member_approved,
)

TREASURER_REQUIRED_DETAIL = "Requires treasurer, president, or vice president"
BOARD_REQUIRED_DETAIL = "Requires board role or higher"

FINANCE_POST_PAYLOAD = {
    "entry_type": "income",
    "category": "fundraising",
    "amount": "150.00",
    "description": "Bake sale proceeds",
}

RECEIPT_UPLOAD_KWARGS = {
    "files": {"file": ("receipt.jpg", b"\xff\xd8\xffreceipt-bytes", "image/jpeg")},
}


@pytest.fixture
def general_member_headers(client, db_session):
    register_member(client)
    set_member_approved(db_session)
    return auth_header(client)


@pytest.fixture
def board_member_headers(client, db_session):
    register_member(client, email="other@semo.edu", student_id="22222222")
    create_board_member(db_session)
    return auth_header(client, email="board@semo.edu")


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


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("get", "/api/v1/finance", {}),
        ("get", "/api/v1/finance/summary", {}),
        ("post", "/api/v1/finance", {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_unauthenticated_request_gets_401_on_finance_endpoints(
    client,
    method,
    path,
    kwargs,
):
    response = client.request(method, path, **kwargs)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("get", "/api/v1/finance", {}),
        ("get", "/api/v1/finance/summary", {}),
        ("post", "/api/v1/finance", {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_general_member_gets_403_on_all_finance_endpoints(
    client,
    general_member_headers,
    method,
    path,
    kwargs,
):
    response = client.request(method, path, headers=general_member_headers, **kwargs)

    assert response.status_code == 403
    assert response.json()["detail"] == TREASURER_REQUIRED_DETAIL


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("get", "/api/v1/finance", {}),
        ("get", "/api/v1/finance/summary", {}),
        ("post", "/api/v1/finance", {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_board_member_gets_403_on_all_finance_endpoints(
    client,
    board_member_headers,
    method,
    path,
    kwargs,
):
    response = client.request(method, path, headers=board_member_headers, **kwargs)

    assert response.status_code == 403
    assert response.json()["detail"] == TREASURER_REQUIRED_DETAIL


@pytest.mark.parametrize(
    "method,path,expected_status,kwargs",
    [
        ("get", "/api/v1/finance", 200, {}),
        ("get", "/api/v1/finance/summary", 200, {}),
        ("post", "/api/v1/finance", 201, {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", 201, RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_treasurer_can_access_all_finance_endpoints(
    client,
    treasurer_member_headers,
    method,
    path,
    expected_status,
    kwargs,
):
    response = client.request(method, path, headers=treasurer_member_headers, **kwargs)

    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "method,path,expected_status,kwargs",
    [
        ("get", "/api/v1/finance", 200, {}),
        ("get", "/api/v1/finance/summary", 200, {}),
        ("post", "/api/v1/finance", 201, {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", 201, RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_president_can_access_all_finance_endpoints(
    client,
    president_member_headers,
    method,
    path,
    expected_status,
    kwargs,
):
    response = client.request(method, path, headers=president_member_headers, **kwargs)

    assert response.status_code == expected_status


@pytest.fixture
def vice_president_member_headers(client, db_session):
    from conftest import create_vice_president_member

    register_member(client, email="other@semo.edu", student_id="22222222")
    create_vice_president_member(db_session)
    return auth_header(client, email="vp@semo.edu")


@pytest.mark.parametrize(
    "method,path,expected_status,kwargs",
    [
        ("get", "/api/v1/finance", 200, {}),
        ("get", "/api/v1/finance/summary", 200, {}),
        ("post", "/api/v1/finance", 201, {"json": FINANCE_POST_PAYLOAD}),
        ("post", "/api/v1/finance/receipts", 201, RECEIPT_UPLOAD_KWARGS),
    ],
    ids=["list-entries", "summary", "create-entry", "upload-receipt"],
)
def test_vice_president_can_access_all_finance_endpoints(
    client,
    vice_president_member_headers,
    method,
    path,
    expected_status,
    kwargs,
):
    response = client.request(
        method,
        path,
        headers=vice_president_member_headers,
        **kwargs,
    )

    assert response.status_code == expected_status


def test_board_member_can_view_event_budget_breakdown(client, board_member_headers):
    response = client.get(
        "/api/v1/finance/event-budgets",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert "events" in response.json()


def test_general_member_cannot_view_event_budget_breakdown(
    client,
    general_member_headers,
):
    response = client.get(
        "/api/v1/finance/event-budgets",
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL


def test_board_member_can_view_expense_by_category(client, board_member_headers):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=board_member_headers,
    )

    assert response.status_code == 200
    assert "categories" in response.json()


def test_general_member_cannot_view_expense_by_category(
    client,
    general_member_headers,
):
    response = client.get(
        "/api/v1/finance/expenses/by-category",
        headers=general_member_headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL
