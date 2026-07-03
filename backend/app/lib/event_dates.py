from datetime import datetime

EVENT_DATE_PAST_ERROR = "Event date can't be in the past"


def validate_starts_at_not_before_today(value: datetime) -> datetime:
    """Allow today or future calendar dates; reject earlier dates only."""
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError("starts_at must include a timezone")

    today = datetime.now(value.tzinfo).date()
    if value.date() < today:
        raise ValueError(EVENT_DATE_PAST_ERROR)

    return value
