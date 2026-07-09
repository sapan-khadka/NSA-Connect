from datetime import UTC, datetime, timedelta

from app.models.event import Event

FINANCE_EDIT_GRACE_PERIOD = timedelta(days=1)


class EventFinanceLockedError(Exception):
    pass


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def get_event_end_at(event: Event) -> datetime:
    if event.ends_at is not None:
        return ensure_utc(event.ends_at)
    return ensure_utc(event.starts_at)


def get_event_finance_lock_at(event: Event) -> datetime:
    return get_event_end_at(event) + FINANCE_EDIT_GRACE_PERIOD


def is_event_finance_locked(event: Event, *, now: datetime | None = None) -> bool:
    current = ensure_utc(now or datetime.now(UTC))
    return current >= get_event_finance_lock_at(event)


def is_event_finance_grace_period(event: Event, *, now: datetime | None = None) -> bool:
    current = ensure_utc(now or datetime.now(UTC))
    return not event.is_upcoming and not is_event_finance_locked(event, now=current)


def assert_event_finance_editable(event: Event, *, now: datetime | None = None) -> None:
    if is_event_finance_locked(event, now=now):
        raise EventFinanceLockedError(
            "Event finances are closed. "
            "The one-day edit window after this event has ended.",
        )
