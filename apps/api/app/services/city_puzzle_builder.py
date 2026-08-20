"""Build city-mode puzzles: one currently-available Funda listing, in the city
whose turn it is that day (see city_for_date).

Reuses the daily builder's listing validation, but selects by city instead of
price bucket, and is price-agnostic (city mode isn't difficulty-tuned; you bid
on whatever is for sale).

Funda's search API is behind Firebase App Check since 2026-08-18 (see the note
in puzzle_builder), so `search(location=...)` is no longer usable. Estate agents
are city-anchored, and the broker-listings endpoint is still open, so each city
carries a pool of local broker ids and we draw from their for-sale feeds.
"""

from __future__ import annotations

import hashlib
import logging
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from app.services.hints import listing_to_payload
from app.services.puzzle_builder import _is_valid_buy_listing

logger = logging.getLogger(__name__)

PUZZLE_TIMEZONE = ZoneInfo("Europe/Amsterdam")

# When bidding closes and the price is revealed: 18:00 Amsterdam on the puzzle
# date. Stored per-row as closes_at, so all reveal logic keys off the timestamp
# (not a hardcoded schedule) — switching to an 18:00-anchored 24h cycle later
# would only change how this is computed, nothing downstream.
REVEAL_HOUR = 18

# Floor to skip parking spots / storage boxes that slip through as "buy".
_CITY_MIN_PRICE = 100_000
# Broker feeds use Funda's raw vocabulary, not the normalized listing statuses.
_BROKER_FOR_SALE = "for_sale"
# Detail fetches per city before giving up on a broker and trying the next.
_DETAIL_PICK_LIMIT = 8


@dataclass(frozen=True)
class City:
    key: str  # stable slug: DB key, frontend id, localStorage namespace
    display: str  # human name; also the value Funda returns as listing.city
    # Funda broker ids for agencies active in this city, most productive first.
    # Harvested from past puzzles in this city; each carries tens to hundreds of
    # for-sale listings. Several per city so one agency going quiet is harmless.
    broker_ids: tuple[str, ...]


# Cities offered in city mode (arbitrary selection; add/remove freely).
CITY_MODE_CITIES: list[City] = [
    City("amsterdam", "Amsterdam", ("24599", "60557", "24824", "24463", "24633")),
    City("rotterdam", "Rotterdam", ("22192", "22230", "63005", "60526", "62826")),
    City("den-haag", "Den Haag", ("8587", "8629", "8346", "55067", "8330")),
    City("utrecht", "Utrecht", ("17385", "17429", "17477", "17123", "17422")),
    City("eindhoven", "Eindhoven", ("14269", "14111", "14029", "14106", "14164")),
    City("groningen", "Groningen", ("9181", "9231", "80868", "9050", "9125")),
    City("tilburg", "Tilburg", ("19268", "19222", "19208", "19259", "19283")),
    City("almere", "Almere", ("26070", "26056", "26102", "63488", "15406")),
    City("den-bosch", "Den Bosch", ("11133", "11088", "11204", "11150", "11219")),
    City("nijmegen", "Nijmegen", ("13117", "13080", "13106", "13036", "63898")),
]
CITIES_BY_KEY: dict[str, City] = {c.key: c for c in CITY_MODE_CITIES}

# City mode runs one city per day, not all ten at once. Days are grouped into
# cycles of len(CITY_MODE_CITIES); each cycle uses every city exactly once, in an
# order derived from the cycle number. So no city goes missing for long, but
# tomorrow's city can't be read off today's.
CITY_CYCLE_EPOCH = date(2026, 1, 1)


def _cycle_order(cycle: int) -> list[City]:
    """The city order for one cycle: a shuffle that depends only on the number.

    Ordering by a hash keeps this stable across Python versions and trivially
    reproducible elsewhere, which random.shuffle(seed) would not guarantee.
    """
    return sorted(
        CITY_MODE_CITIES,
        key=lambda c: hashlib.sha256(f"{cycle}:{c.key}".encode()).hexdigest(),
    )


def city_for_date(puzzle_date: date) -> City:
    """The single city played on this date."""
    cycle, offset = divmod((puzzle_date - CITY_CYCLE_EPOCH).days, len(CITY_MODE_CITIES))
    return _cycle_order(cycle)[offset]


def reveal_time_for_date(puzzle_date: date) -> datetime:
    """closes_at for a puzzle date: 18:00 Europe/Amsterdam (tz-aware)."""
    return datetime.combine(puzzle_date, time(REVEAL_HOUR, 0), tzinfo=PUZZLE_TIMEZONE)


def _city_matches(listing: Any, display: str) -> bool:
    city = getattr(listing, "city", None)
    return bool(city) and city.casefold() == display.casefold()


def _broker_for_sale_in_city(client: Any, broker_id: str, city: City) -> list[int]:
    """global_ids this broker currently has for sale inside the city itself."""
    try:
        listings = client.broker_listings(broker_id)
    except Exception as exc:
        msg = f"⚠️  Broker {broker_id} feed failed for {city.key}: {exc}"
        logger.warning(msg)
        print(msg, file=sys.stderr, flush=True)
        return []

    global_ids = []
    for entry in listings:
        if entry.get("status") != _BROKER_FOR_SALE:
            continue
        entry_city = entry.get("city") or ""
        if entry_city.casefold() != city.display.casefold():
            continue
        price = entry.get("price")
        if not price or price < _CITY_MIN_PRICE:
            continue
        global_id = entry.get("listing_id")
        if global_id:
            global_ids.append(global_id)
    return global_ids


def _pick_city_detail(client: Any, global_ids: list[int], city: City) -> Any | None:
    """Fetch details until one passes full validation for this city."""
    shuffled = list(global_ids)
    random.shuffle(shuffled)
    for global_id in shuffled[:_DETAIL_PICK_LIMIT]:
        try:
            detail = client.listing(global_id)
        except Exception:
            continue
        # The broker feed can lag Funda's own listing state, so re-check status
        # on the detail rather than trusting the feed.
        if getattr(detail, "status", None) != "available":
            continue
        if not _is_valid_buy_listing(detail, strict_existing=True):
            continue
        if not _city_matches(detail, city.display):
            continue
        if detail.price.amount < _CITY_MIN_PRICE:
            continue
        return detail
    return None


def fetch_random_listing_for_city(city: City) -> Any:
    """Pick a random currently-available buy listing in the given city."""
    from funda import Funda

    brokers = list(city.broker_ids)
    random.shuffle(brokers)

    with Funda() as client:
        for broker_id in brokers:
            global_ids = _broker_for_sale_in_city(client, broker_id, city)
            if not global_ids:
                continue
            detail = _pick_city_detail(client, global_ids, city)
            if detail is not None:
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
