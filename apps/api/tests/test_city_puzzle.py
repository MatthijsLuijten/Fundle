"""Offline unit tests for city-mode building (no network)."""

from datetime import date
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.city_puzzle_builder import (
    CITIES_BY_KEY,
    CITY_MODE_CITIES,
    REVEAL_HOUR,
    _city_matches,
    reveal_time_for_date,
)


def test_cities_have_unique_keys():
    assert len(CITY_MODE_CITIES) == 10
    keys = [c.key for c in CITY_MODE_CITIES]
    assert len(set(keys)) == len(keys)
    assert set(keys) == set(CITIES_BY_KEY)


def test_den_haag_uses_hyphen_slug():
    # Funda's search location only lowercases; spaces must already be hyphens.
    den_haag = CITIES_BY_KEY["den-haag"]
    assert den_haag.funda_location == "den-haag"
    assert den_haag.display == "Den Haag"


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
