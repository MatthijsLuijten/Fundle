"""Offline unit tests for city-mode building (no network)."""

from datetime import date, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.city_puzzle_builder import (
    CITIES_BY_KEY,
    CITY_CYCLE_EPOCH,
    CITY_MODE_CITIES,
    REVEAL_HOUR,
    _city_matches,
    city_for_date,
    reveal_time_for_date,
)


def test_cities_have_unique_keys():
    assert len(CITY_MODE_CITIES) == 10
    keys = [c.key for c in CITY_MODE_CITIES]
    assert len(set(keys)) == len(keys)
    assert set(keys) == set(CITIES_BY_KEY)


def test_every_city_has_a_broker_pool():
    # Listings are drawn from these agencies' for-sale feeds, so an empty pool
    # means that city can never build. Several per city tolerates one going quiet.
    for city in CITY_MODE_CITIES:
        assert len(city.broker_ids) >= 2, city.key
        assert len(set(city.broker_ids)) == len(city.broker_ids), city.key
    assert CITIES_BY_KEY["den-haag"].display == "Den Haag"


def test_reveal_time_is_18_amsterdam():
    closes = reveal_time_for_date(date(2026, 7, 20))
    assert closes.tzinfo == ZoneInfo("Europe/Amsterdam")
    assert closes.hour == REVEAL_HOUR
    assert closes.date() == date(2026, 7, 20)


def test_city_matches_is_case_insensitive():
    assert _city_matches(SimpleNamespace(city="Amsterdam"), "amsterdam")
    assert _city_matches(SimpleNamespace(city="den haag"), "Den Haag")  # only case differs
    # A neighbouring municipality that leaks into the search is rejected.
    assert _city_matches(SimpleNamespace(city="Amstelveen"), "Amsterdam") is False
    assert _city_matches(SimpleNamespace(city=None), "Amsterdam") is False


def _cycle_days(cycle: int) -> list[date]:
    start = CITY_CYCLE_EPOCH + timedelta(days=cycle * len(CITY_MODE_CITIES))
    return [start + timedelta(days=i) for i in range(len(CITY_MODE_CITIES))]


def test_each_cycle_uses_every_city_exactly_once():
    for cycle in range(25):
        keys = [city_for_date(d).key for d in _cycle_days(cycle)]
        assert sorted(keys) == sorted(CITIES_BY_KEY), f"cycle {cycle} is not a permutation"


def test_city_for_date_is_stable():
    # Same date always gives the same city; the builder and any backfill have to
    # agree without storing state anywhere.
    day = date(2026, 8, 20)
    assert city_for_date(day).key == city_for_date(day).key
    assert city_for_date(day) in CITY_MODE_CITIES


def test_cycles_are_not_all_the_same_order():
    # A fixed rotation would make tomorrow's city guessable from today's.
    first = [city_for_date(d).key for d in _cycle_days(0)]
    later = [[city_for_date(d).key for d in _cycle_days(c)] for c in range(1, 10)]
    assert any(order != first for order in later)


def test_dates_before_the_epoch_still_resolve():
    # divmod floors, so a negative day index stays in range instead of raising.
    assert city_for_date(CITY_CYCLE_EPOCH - timedelta(days=1)) in CITY_MODE_CITIES
    assert city_for_date(CITY_CYCLE_EPOCH - timedelta(days=37)) in CITY_MODE_CITIES
