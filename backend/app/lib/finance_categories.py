import re

from app.models.finance_entry import FinanceCategory

FINANCE_CATEGORY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


def normalize_finance_category(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Category must be a string")

    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")

    if len(normalized) < 2:
        raise ValueError("Category must be at least 2 characters")
    if len(normalized) > 64:
        raise ValueError("Category must be at most 64 characters")
    if not FINANCE_CATEGORY_PATTERN.match(normalized):
        raise ValueError("Category must start with a letter and use only letters, numbers, and underscores")

    return normalized


def is_known_finance_category(value: str) -> bool:
    return value in {category.value for category in FinanceCategory}
