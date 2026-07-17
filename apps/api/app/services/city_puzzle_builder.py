"""Build city-mode puzzles: one currently-available Funda listing per city.

Reuses the daily builder's listing validation + detail-fetch helpers, but selects
by city (Funda `search(location=...)`) instead of price bucket, and is price-
agnostic (city mode isn't difficulty-tuned; you bid on whatever is for sale).
"""

from __future__ import annotations

import logging
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from app.services.hints import listing_to_payload
from app.services.puzzle_builder import (
    _PAGE_ATTEMPTS,
    _SEARCH_SORT,
    _is_valid_buy_listing,
    _pick_listing_detail,
)

logger = logging.getLogger(__name__)

PUZZLE_TIMEZONE = ZoneInfo("Europe/Amsterdam")

# When bidding closes and the price is revealed: 18:00 Amsterdam on the puzzle
# date. Stored per-row as closes_at, so all reveal logic keys off the timestamp
# (not a hardcoded schedule) — switching to an 18:00-anchored 24h cycle later
# would only change how this is computed, nothing downstream.
REVEAL_HOUR = 18

# Cities have far fewer listings than all-NL, so probe a smaller page range.
_CITY_MAX_SEARCH_PAGE = 40
# Floor to skip parking spots / storage boxes that slip through as "buy".
_CITY_MIN_PRICE = 100_000


@dataclass(frozen=True)
class City:
    key: str  # stable slug: DB key, frontend id, localStorage namespace
    display: str  # human name; also the value Funda returns as listing.city
    funda_location: str  # search slug passed to Funda `search(location=...)`


# Cities offered in city mode (arbitrary selection; add/remove freely).
CITY_MODE_CITIES: list[City] = [
    City("amsterdam", "Amsterdam", "amsterdam"),
    City("rotterdam", "Rotterdam", "rotterdam"),
    City("den-haag", "Den Haag", "den-haag"),
    City("utrecht", "Utrecht", "utrecht"),
    City("eindhoven", "Eindhoven", "eindhoven"),
    City("groningen", "Groningen", "groningen"),
    City("tilburg", "Tilburg", "tilburg"),
    City("almere", "Almere", "almere"),
    City("den-bosch", "Den Bosch", "den-bosch"),
    City("nijmegen", "Nijmegen", "nijmegen"),
]
CITIES_BY_KEY: dict[str, City] = {c.key: c for c in CITY_MODE_CITIES}


def reveal_time_for_date(puzzle_date: date) -> datetime:
    """closes_at for a puzzle date: 18:00 Europe/Amsterdam (tz-aware)."""
    return datetime.combine(puzzle_date, time(REVEAL_HOUR, 0), tzinfo=PUZZLE_TIMEZONE)


def _city_matches(listing: Any, display: str) -> bool:
    city = getattr(listing, "city", None)
    return bool(city) and city.casefold() == display.casefold()


def _search_city_candidates(client: Any, *, location: str, page: int) -> list[Any]:
    results = client.search(location, category="buy", sort=_SEARCH_SORT, page=page)
    return [r for r in results if _is_valid_buy_listing(r)]


def _city_candidates_from_random_page(client: Any, *, location: str) -> list[Any]:
    upper = _CITY_MAX_SEARCH_PAGE
    for _ in range(_PAGE_ATTEMPTS):
        page = random.randint(0, upper)
        candidates = _search_city_candidates(client, location=location, page=page)
        if candidates:
            return candidates
        if page == 0:
            break
        upper = min(upper, max(0, page - 1))
    return []


def fetch_random_listing_for_city(city: City) -> Any:
    """Pick a random currently-available buy listing in the given city."""
    from funda import Funda

    with Funda() as client:
        for _ in range(_PAGE_ATTEMPTS):
            candidates = _city_candidates_from_random_page(client, location=city.funda_location)
            candidates = [c for c in candidates if _city_matches(c, city.display)]
            if not candidates:
                continue
            detail = _pick_listing_detail(
                client, candidates, min_price=_CITY_MIN_PRICE, max_price=None
            )
            if detail is not None and _city_matches(detail, city.display):
                return detail
        raise RuntimeError(f"Could not load a listing for city {city.key!r}")


def build_city_live_puzzle(city: City) -> tuple[int, int, dict]:
    """Return (global_id, answer_eur, payload) for one listing in the city."""
    listing = fetch_random_listing_for_city(city)
    amount = listing.price.amount
    if amount is None:
        raise RuntimeError(f"Listing for {city.key} has no price")
    print(f"\033[92m✓ {city.display}: €{amount:,}\033[0m", file=sys.stderr, flush=True)
    return listing.global_id or int(listing.id), amount, listing_to_payload(listing)
