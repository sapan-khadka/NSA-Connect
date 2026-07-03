from datetime import UTC, datetime, timedelta

import pytest

from app.lib.event_dates import EVENT_DATE_PAST_ERROR, validate_starts_at_not_before_today


def test_validate_starts_at_rejects_yesterday():
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    value = datetime(
        yesterday.year,
        yesterday.month,
        yesterday.day,
        18,
        0,
        tzinfo=UTC,
    )

    with pytest.raises(ValueError, match=EVENT_DATE_PAST_ERROR):
        validate_starts_at_not_before_today(value)


def test_validate_starts_at_allows_today_even_if_time_passed():
    now = datetime.now(UTC)
    earlier_today = now.replace(hour=0, minute=1, second=0, microsecond=0)

    assert validate_starts_at_not_before_today(earlier_today) == earlier_today
