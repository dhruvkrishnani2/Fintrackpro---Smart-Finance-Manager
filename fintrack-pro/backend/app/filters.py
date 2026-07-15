"""Shared date-range helpers used by the transactions list and report exports,
so "filter by month" means the actual calendar month, not "on or after".
"""
from datetime import datetime
from typing import Optional, Tuple


def month_bounds(month: int, year: int) -> Tuple[datetime, datetime]:
    """Returns [start, end) for the given calendar month."""
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    return start, end


def year_bounds(year: int) -> Tuple[datetime, datetime]:
    """Returns [start, end) for the given calendar year."""
    return datetime(year, 1, 1), datetime(year + 1, 1, 1)


def resolve_date_range(month: Optional[int], year: Optional[int]) -> Optional[Tuple[datetime, datetime]]:
    """Resolves optional month/year query params into a [start, end) range.

    - month + year (or month alone, defaulting year to current) -> that month
    - year alone -> that whole year
    - neither -> None (no date filtering)
    """
    if month:
        return month_bounds(month, year or datetime.utcnow().year)
    if year:
        return year_bounds(year)
    return None
