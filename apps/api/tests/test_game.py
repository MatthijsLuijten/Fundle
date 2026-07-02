"""Game logic tests for photo reveals and guess evaluation."""

from datetime import date

from app.services.game import (
    PHOTOS_PER_GUESS,
    _build_photo_order,
    _index_at_percentile,
    _photo_pool,
    evaluate_guess,
    puzzle_number_for_date,
    revealed_photos,
)
from app.models import GameSession


def test_photo_pool_from_photo_urls():
    """Photo pool prefers photo_urls list."""
    payload = {"photo_urls": ["url1", "url2", "url3"]}
    assert _photo_pool(payload) == ["url1", "url2", "url3"]


def test_photo_pool_filters_empty_strings():
    """Photo pool filters out empty strings."""
    payload = {"photo_urls": ["url1", "", "url2"]}
    assert _photo_pool(payload) == ["url1", "url2"]


def test_photo_pool_fallback_to_single():
    """Photo pool falls back to single photo_url."""
    payload = {"photo_url": "single_url"}
    assert _photo_pool(payload) == ["single_url"]


def test_photo_pool_empty():
    """Photo pool is empty when no photos."""
    assert _photo_pool({}) == []


def test_index_at_percentile():
    """Percentile mapping spreads indices correctly."""
    assert _index_at_percentile(1, 5, 10) >= 1
    assert _index_at_percentile(5, 5, 10) >= 7


def test_build_photo_order_no_photos():
    """No photos returns empty order."""
    assert _build_photo_order({}) == []


def test_build_photo_order_single_photo():
    """Single photo returns itself."""
    payload = {"photo_urls": ["url1"]}
    assert _build_photo_order(payload) == ["url1"]


def test_build_photo_order_multiple_photos():
    """Multiple photos start with first, then spread picks."""
    payload = {"photo_urls": ["url0", "url1", "url2", "url3", "url4"]}
    order = _build_photo_order(payload)
    assert order[0] == "url0"
    assert len(order) > 1


def test_revealed_photos_no_guesses():
    """No guesses reveals only first photo."""
    session = GameSession(
        session_id="test",
        puzzle_date=date.today(),
        guesses=[],
        hint_level=0,
        status="playing",
        photo_order=["url0", "url1", "url2", "url3"],
    )
    payload = {"photo_urls": ["url0", "url1", "url2", "url3"]}
    photos = revealed_photos(session, payload)
    assert len(photos) == 1
    assert photos[0] == "url0"


def test_revealed_photos_increments_with_guesses():
    """Each guess unlocks PHOTOS_PER_GUESS more photos."""
    session = GameSession(
        session_id="test",
        puzzle_date=date.today(),
        guesses=[{"amount": 100}, {"amount": 200}],
        hint_level=0,
        status="playing",
        photo_order=["url0", "url1", "url2", "url3", "url4", "url5"],
    )
    payload = {}
    photos = revealed_photos(session, payload)
    assert len(photos) == 1 + PHOTOS_PER_GUESS * 2


def test_revealed_photos_final_guess_front_loads_remaining():
    """The final guess unlocks all remaining photos up front, instead of leaving
    a batch to appear uselessly after the last guess is spent."""
    photo_order = [f"url{i}" for i in range(11)]
    session = GameSession(
        session_id="test",
        puzzle_date=date.today(),
        guesses=[{"amount": a} for a in (1, 2, 3, 4)],  # 4 guesses -> final pending
        hint_level=0,
        status="playing",
        photo_order=photo_order,
    )
    photos = revealed_photos(session, {})
    assert photos == photo_order


def test_revealed_photos_won_shows_all():
    """Won status reveals all photos."""
    photo_order = ["url0", "url1", "url2", "url3"]
    session = GameSession(
        session_id="test",
        puzzle_date=date.today(),
        guesses=[],
        hint_level=4,
        status="won",
        photo_order=photo_order,
    )
    payload = {}
    photos = revealed_photos(session, payload)
    assert photos == photo_order


def test_evaluate_guess_correct():
    """Guess within tolerance is correct."""
    correct, direction, delta = evaluate_guess(100_000, 101_000)
    assert correct is True
    assert direction is None


def test_evaluate_guess_high():
    """High guess returns direction."""
    correct, direction, delta = evaluate_guess(100_000, 150_000)
    assert correct is False
    assert direction == "high"


def test_evaluate_guess_low():
    """Low guess returns direction."""
    correct, direction, delta = evaluate_guess(100_000, 50_000)
    assert correct is False
    assert direction == "low"


def test_evaluate_guess_zero_answer():
    """Zero answer only matches zero guess."""
    correct, direction, delta = evaluate_guess(0, 0)
    assert correct is True
    correct, direction, delta = evaluate_guess(0, 100)
    assert correct is False


def test_puzzle_number_for_date():
    """Puzzle number increments from epoch."""
    epoch = date(2026, 1, 1)
    assert puzzle_number_for_date(epoch) == 1
    assert puzzle_number_for_date(date(2026, 1, 2)) == 2
    assert puzzle_number_for_date(date(2026, 1, 8)) == 8
