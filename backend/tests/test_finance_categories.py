import pytest

from app.lib.finance_categories import normalize_finance_category


@pytest.mark.parametrize(
    "value, expected",
    [
        ("Equipment Rental", "equipment_rental"),
        ("equipment_rental", "equipment_rental"),
        ("  NSA  T-shirts  ", "nsa_t_shirts"),
        ("food_beverage", "food_beverage"),
    ],
)
def test_normalize_finance_category(value, expected):
    assert normalize_finance_category(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "",
        "a",
        "9equipment",
        "!!!",
    ],
)
def test_normalize_finance_category_rejects_invalid(value):
    with pytest.raises(ValueError):
        normalize_finance_category(value)
