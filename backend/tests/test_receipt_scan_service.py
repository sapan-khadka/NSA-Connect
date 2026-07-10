from decimal import Decimal

from app.services.receipt_scan_service import _to_scan_response


def test_to_scan_response_builds_description_with_vendor_and_date():
    result = _to_scan_response(
        {
            "is_receipt": True,
            "vendor": "Target",
            "purchase_date": "2026-04-01",
            "purchase_time": "09:15",
            "amount": "18.50",
            "description": "Napkins and cups",
            "category": "supplies",
            "confidence": "high",
        }
    )

    assert result.readable is True
    assert result.amount == Decimal("18.50")
    assert result.category == "supplies"
    assert result.description == "Target — Napkins and cups (purchased 2026-04-01)"


def test_to_scan_response_drops_unknown_category_and_low_confidence_without_amount():
    result = _to_scan_response(
        {
            "is_receipt": True,
            "vendor": "Somewhere",
            "purchase_date": None,
            "amount": None,
            "description": "Stuff",
            "category": "not_a_real_category",
            "confidence": "high",
        }
    )

    assert result.readable is False
    assert result.category is None
    assert result.confidence == "low"


def test_to_scan_response_marks_non_receipt_unreadable():
    result = _to_scan_response(
        {
            "is_receipt": False,
            "vendor": "Nope",
            "amount": "10.00",
            "confidence": "high",
        }
    )

    assert result.readable is False
    assert result.amount is None
