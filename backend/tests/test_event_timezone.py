from datetime import UTC, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.lib.event_timezone import format_event_moment, resolve_event_timezone


def test_default_timezone_is_chicago_without_hardcoding_callers():
    assert settings.DEFAULT_EVENT_TIMEZONE == "America/Chicago"
    assert resolve_event_timezone(None) == ZoneInfo("America/Chicago")
    organization = SimpleNamespace(slug="nsa")
    assert resolve_event_timezone(organization) == ZoneInfo("America/Chicago")


def test_future_organization_timezone_overrides_the_default():
    organization = SimpleNamespace(timezone="America/New_York")
    zone = resolve_event_timezone(organization)
    moment = format_event_moment(datetime(2026, 11, 28, 0, 0, tzinfo=UTC), zone)
    assert moment == "Friday, November 27, 2026 at 7:00 PM EST"


def test_invalid_organization_timezone_falls_back_to_the_default():
    organization = SimpleNamespace(timezone="Not/AZone")
    assert resolve_event_timezone(organization) == ZoneInfo(settings.DEFAULT_EVENT_TIMEZONE)


def test_utc_midnight_is_previous_evening_in_chicago():
    zone = resolve_event_timezone(None)
    moment = format_event_moment(datetime(2026, 11, 28, 0, 0, tzinfo=UTC), zone)
    assert moment == "Friday, November 27, 2026 at 6:00 PM CST"


def test_daylight_saving_uses_central_daylight_time():
    zone = resolve_event_timezone(None)
    moment = format_event_moment(datetime(2026, 7, 15, 0, 0, tzinfo=UTC), zone)
    assert moment == "Tuesday, July 14, 2026 at 7:00 PM CDT"


def test_midnight_boundary_stays_on_the_local_calendar_day():
    zone = resolve_event_timezone(None)
    before = format_event_moment(datetime(2026, 11, 28, 5, 59, tzinfo=UTC), zone)
    at_midnight = format_event_moment(datetime(2026, 11, 28, 6, 0, tzinfo=UTC), zone)
    assert before == "Friday, November 27, 2026 at 11:59 PM CST"
    assert at_midnight == "Saturday, November 28, 2026 at 12:00 AM CST"
