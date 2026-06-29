import pytest

from conftest import (
    auth_header,
    create_board_member,
    register_member,
    set_member_approved,
)

BOARD_REQUIRED_DETAIL = "Requires board role or higher"


def _event_payload(**overrides):
    payload = {
        "name": "Dashain Celebration",
        "starts_at": "2030-06-01T18:00:00+00:00",
        "event_type": "cultural",
        "description": "Annual NSA cultural night.",
        "budget": "250.00",
    }
    payload.update(overrides)
    return payload


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


def _create_event(client, headers, **overrides):
    response = client.post(
        "/api/v1/events",
        json=_event_payload(**overrides),
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_board_member_can_delete_event(client, board_member_headers):
    event = _create_event(client, board_member_headers)

    response = client.delete(
        f"/api/v1/events/{event['id']}",
        headers=board_member_headers,
    )
    assert response.status_code == 204

    detail = client.get(
        f"/api/v1/events/{event['id']}",
        headers=board_member_headers,
    )
    assert detail.status_code == 404


def test_delete_event_unlinks_finance_entries(
    client,
    board_member_headers,
    db_session,
):
    from app.models.finance_entry import FinanceEntry

    event = _create_event(client, board_member_headers)

    # Board members are treasurer-or-higher? No — finance requires treasurer.
    # Insert a finance entry directly tied to the event to verify unlinking.
    from conftest import create_treasurer_member

    create_treasurer_member(db_session)
    treasurer_headers = auth_header(client, email="treasurer@semo.edu")

    created = client.post(
        "/api/v1/finance",
        json={
            "entry_type": "expense",
            "category": "venue",
            "amount": "50.00",
            "description": "Deposit",
            "event_id": event["id"],
        },
        headers=treasurer_headers,
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    response = client.delete(
        f"/api/v1/events/{event['id']}",
        headers=board_member_headers,
    )
    assert response.status_code == 204

    entry = db_session.get(FinanceEntry, entry_id)
    assert entry is not None
    assert entry.event_id is None


def test_delete_missing_event_returns_404(client, board_member_headers):
    response = client.delete(
        "/api/v1/events/9999",
        headers=board_member_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Event not found"


def test_general_member_cannot_delete_event(
    client,
    board_member_headers,
    general_member_headers,
):
    event = _create_event(client, board_member_headers)

    response = client.delete(
        f"/api/v1/events/{event['id']}",
        headers=general_member_headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == BOARD_REQUIRED_DETAIL
