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


def get_current_semester_slug(as_of: datetime | None = None) -> str:
    """Return the active semester slug (e.g. 2026-spring) for a given UTC datetime."""
    dt = as_of or datetime.now(UTC)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    else:
        dt = dt.astimezone(UTC)

    year = dt.year
    month = dt.month
    if month <= 5:
        return f"{year}-spring"
    if month <= 7:
        return f"{year}-summer"
    return f"{year}-fall"


def format_semester_label(semester: str) -> str:
    year, term = semester.rsplit("-", 1)
    return f"{term.capitalize()} {year}"


def semesters_overlapping_range(
    period_start: datetime,
    period_end: datetime,
) -> list[str]:
    """Return semester slugs whose [start, end) bounds overlap [period_start, period_end)."""
    if period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=UTC)
    else:
        period_start = period_start.astimezone(UTC)
    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=UTC)
    else:
        period_end = period_end.astimezone(UTC)

    start_year = period_start.year - 1
    end_year = period_end.year + 1
    terms = ("spring", "summer", "fall")
    overlapping: list[str] = []

    for year in range(start_year, end_year + 1):
        for term in terms:
            slug = f"{year}-{term}"
            try:
                sem_start, sem_end = semester_date_range(slug)
            except InvalidSemesterError:
                continue
            if sem_start < period_end and sem_end > period_start:
                overlapping.append(slug)

    return overlapping
