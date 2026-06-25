from datetime import UTC, datetime

import pytest

from app.lib.semester import semester_date_range
from app.models.event import Event, EventType
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from conftest import create_board_member, create_treasurer_member


def test_semester_date_range_spring():
    start, end = semester_date_range("2026-spring")
    assert start == datetime(2026, 1, 1, tzinfo=UTC)
    assert end == datetime(2026, 6, 1, tzinfo=UTC)


def test_semester_date_range_fall():
    start, end = semester_date_range("2026-fall")
    assert start == datetime(2026, 8, 1, tzinfo=UTC)
    assert end == datetime(2027, 1, 1, tzinfo=UTC)


def test_semester_date_range_rejects_invalid_term():
    with pytest.raises(ValueError):
        semester_date_range("2026-winter")
