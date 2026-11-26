"""Present stored UTC event timestamps in an organization's timezone.

Organizations can later carry their own IANA timezone. Until that value
exists, callers fall back to the configured default. ZoneInfo applies
daylight-saving transitions for the chosen zone.
"""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings


def resolve_event_timezone(organization: object | None = None) -> ZoneInfo:
    """Return the timezone used to display event times for an organization."""
    configured = _organization_timezone_name(organization) or settings.DEFAULT_EVENT_TIMEZONE
    zone = _zone_or_none(configured)
    if zone is not None:
        return zone
    fallback = _zone_or_none(settings.DEFAULT_EVENT_TIMEZONE)
    if fallback is not None:
        return fallback
    return ZoneInfo("UTC")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=UTC)
    return value


def format_local_date(value: datetime, timezone: ZoneInfo) -> str:
    """Calendar date of a stored instant in the given timezone."""
    local = _as_utc(value).astimezone(timezone)
    return f"{local.strftime('%A, %B')} {local.day}, {local.year}"


def format_event_moment(value: datetime, timezone: ZoneInfo) -> str:
    """Format a stored UTC instant in the given timezone, including its abbreviation."""
    local = _as_utc(value).astimezone(timezone)
    hour = local.strftime("%I").lstrip("0") or "12"
    when = (
        f"{local.strftime('%A, %B')} {local.day}, {local.year} at "
        f"{hour}:{local.strftime('%M %p')}"
    )
    zone_label = local.tzname() or ""
    if zone_label:
        return f"{when} {zone_label}"
    return when


def _organization_timezone_name(organization: object | None) -> str | None:
    if organization is None:
        return None
    raw = getattr(organization, "timezone", None)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _zone_or_none(name: str) -> ZoneInfo | None:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return None
