"""Calendar date for the daily puzzle (Netherlands local day)."""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

PUZZLE_TIMEZONE = ZoneInfo("Europe/Amsterdam")


def today_date() -> date:
    return datetime.now(PUZZLE_TIMEZONE).date()
