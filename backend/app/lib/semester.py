from datetime import UTC, datetime


class InvalidSemesterError(ValueError):
    pass


SEMESTER_QUERY_PATTERN = r"^(19|20)\d{2}-(spring|summer|fall)$"


def semester_date_range(semester: str) -> tuple[datetime, datetime]:
    """Return UTC [start, end) bounds for a semester slug like 2026-spring."""
    try:
        year_str, term = semester.rsplit("-", 1)
        year = int(year_str)
    except ValueError as exc:
        raise InvalidSemesterError(f"Invalid semester format: {semester}") from exc

    if term == "spring":
        start = datetime(year, 1, 1, tzinfo=UTC)
        end = datetime(year, 6, 1, tzinfo=UTC)
    elif term == "summer":
        start = datetime(year, 6, 1, tzinfo=UTC)
        end = datetime(year, 8, 1, tzinfo=UTC)
    elif term == "fall":
        start = datetime(year, 8, 1, tzinfo=UTC)
        end = datetime(year + 1, 1, 1, tzinfo=UTC)
    else:
        raise InvalidSemesterError(f"Unknown semester term: {term}")

    return start, end
