"""Fetch listings from Funda and build daily puzzles."""

from __future__ import annotations

import logging
import os
import random
import sys
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailyPuzzle, GameSession
from app.services.funda_url import funda_listing_url
from app.services.hints import listing_to_payload

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Funda search results only include ~5 thumbnail ids; detail has the full gallery.
SEARCH_THUMB_PHOTO_LIMIT = 6


def _listing_construction_type(listing: Any) -> str | None:
    details = getattr(listing, "property_details", None)
    if details is None:
        return None
    return getattr(details, "construction_type", None)


def _is_existing_construction(listing: Any, *, strict: bool = False) -> bool:
    from funda._parse_helpers import normalize_construction_type

    normalized = normalize_construction_type(_listing_construction_type(listing))
    if normalized is None:
        return not strict
    return normalized == "existing"


def _is_valid_buy_listing(listing: Any, *, strict_existing: bool = False) -> bool:
    if listing.offering_type != "buy":
        return False
    amount = listing.price.amount
    if amount is None:
        return False
    if listing.price.is_auction:
        return False
    if listing.price.range_min and listing.price.range_max and not amount:
        return False
    if not listing.city:
        return False
    if not _is_existing_construction(listing, strict=strict_existing):
        return False
    return True


_MAX_SEARCH_PAGE = 800
_PAGE_ATTEMPTS = 8
_DETAIL_PICK_LIMIT = 20
_SEARCH_SORT = "newest"

# Default price buckets. Format: min:max:weight (semicolon-separated).
# Max can be empty for uncapped. Weights must sum to 1.0.
# Boundaries are exclusive on the upper end: 150000:400000 means [150000, 400000).
# Weights: 20% [150k, 400k), 30% [400k, 600k), 30% [600k, 900k), 15% [900k, 1.4M), 5% [1.4M, ∞)
_DEFAULT_PRICE_BUCKETS = "150000:400000:0.20;400000:600000:0.30;600000:900000:0.30;900000:1400000:0.15;1400000::0.05"


def _parse_price_buckets() -> list[tuple[int, int | None, float]]:
    """Parse PRICE_BUCKETS env var. Format: min:max:weight (semicolon-separated).
    Max can be empty for uncapped. Returns [(min, max, weight), ...].
    Normalizes weights if they don't sum to 1.0 and logs a warning.
    Detects overlapping partitions and gaps.
    """
    config = os.getenv("PRICE_BUCKETS", _DEFAULT_PRICE_BUCKETS)

    buckets = []
    total_weight = 0.0
    for segment in config.split(";"):
        parts = segment.split(":")
        if len(parts) != 3:
            msg = f"❌ Invalid PRICE_BUCKETS format: {segment}"
            logger.error(msg)
            print(msg, file=sys.stderr, flush=True)
            continue
        try:
            min_price = int(parts[0])
            max_price = int(parts[1]) if parts[1] else None
            weight = float(parts[2])
        except ValueError as e:
            msg = f"❌ Invalid PRICE_BUCKETS values: {segment} ({e})"
            logger.error(msg)
            print(msg, file=sys.stderr, flush=True)
            continue
        if weight < 0:
            msg = f"❌ PRICE_BUCKETS weight must be >= 0: {segment}"
            logger.error(msg)
            print(msg, file=sys.stderr, flush=True)
            continue
        if max_price is not None and min_price >= max_price:
            msg = f"❌ PRICE_BUCKETS: min_price must be < max_price: {segment}"
            logger.error(msg)
            print(msg, file=sys.stderr, flush=True)
            continue
        buckets.append((min_price, max_price, weight))
        total_weight += weight

    if not buckets:
        msg = "❌ No valid PRICE_BUCKETS defined, using defaults"
        logger.error(msg)
        print(msg, file=sys.stderr, flush=True)
        return _parse_price_buckets_from_string(_DEFAULT_PRICE_BUCKETS)

    _check_bucket_partitions(buckets)

    if abs(total_weight - 1.0) > 0.001:
        msg = (
            f"⚠️  PRICE_BUCKETS weights sum to {total_weight:.3f}, not 1.0. "
            "Normalizing. Check fundle.config.env PRICE_BUCKETS."
        )
        logger.warning(msg)
        print(msg, file=sys.stderr, flush=True)
        buckets = [(lo, hi, w / total_weight) for lo, hi, w in buckets]

    return buckets


def _check_bucket_partitions(buckets: list[tuple[int, int | None, float]]) -> None:
    """Warn if price buckets overlap or have gaps."""
    if len(buckets) < 2:
        return

    capped_buckets = [(lo, hi) for lo, hi, _ in buckets if hi is not None]
    uncapped_buckets = [(lo, hi) for lo, hi, _ in buckets if hi is None]

    for i, (lo1, hi1) in enumerate(capped_buckets):
        for lo2, hi2 in capped_buckets[i + 1 :]:
            if not (hi1 <= lo2 or hi2 <= lo1):
                msg = (
                    f"⚠️  PRICE_BUCKETS overlap detected: "
                    f"[{lo1}, {hi1}) and [{lo2}, {hi2}). "
                    "Boundaries are exclusive on upper end (e.g., 150000:400000 means [150000, 400000))."
                )
                logger.warning(msg)
                print(msg, file=sys.stderr, flush=True)

    sorted_buckets = sorted(capped_buckets)
    for i in range(len(sorted_buckets) - 1):
        _, hi1 = sorted_buckets[i]
        lo2, _ = sorted_buckets[i + 1]
        if hi1 != lo2:
            msg = f"⚠️  PRICE_BUCKETS gap detected: bucket ends at {hi1}, next starts at {lo2}. Gap: [{hi1}, {lo2})."
            logger.warning(msg)
            print(msg, file=sys.stderr, flush=True)

    if capped_buckets and uncapped_buckets:
        last_capped_hi = sorted_buckets[-1][1]
        first_uncapped_lo = uncapped_buckets[0][0]
        if last_capped_hi != first_uncapped_lo:
            msg = (
                f"⚠️  PRICE_BUCKETS gap at uncapped boundary: "
                f"last capped bucket ends at {last_capped_hi}, "
                f"uncapped starts at {first_uncapped_lo}. "
                f"Gap: [{last_capped_hi}, {first_uncapped_lo})."
            )
            logger.warning(msg)
            print(msg, file=sys.stderr, flush=True)


def _parse_price_buckets_from_string(
    config: str,
) -> list[tuple[int, int | None, float]]:
    """Helper to parse bucket string without weight normalization (for defaults)."""
    buckets = []
    for segment in config.split(";"):
        parts = segment.split(":")
        min_price = int(parts[0])
        max_price = int(parts[1]) if parts[1] else None
        weight = float(parts[2])
        buckets.append((min_price, max_price, weight))
    return buckets


_PRICE_BUCKETS = _parse_price_buckets()


def _pick_price_bucket() -> tuple[int, int | None]:
    ranges = [(lo, hi) for lo, hi, _ in _PRICE_BUCKETS]
    weights = [w for _, _, w in _PRICE_BUCKETS]
    return random.choices(ranges, weights=weights, k=1)[0]


def _search_candidates(
    client: Any,
    *,
    min_price: int | None,
    max_price: int | None,
    page: int,
) -> list[Any]:
    filters: dict[str, Any] = {
        "category": "buy",
        "sort": _SEARCH_SORT,
        "page": page,
    }
    if min_price is not None:
        filters["min_price"] = min_price
    if max_price is not None:
        filters["max_price"] = max_price
    from funda.exceptions import SearchError

    try:
        results = client.search(**filters)
    except SearchError as exc:
        # Funda's Elasticsearch backend intermittently 400s ("all shards
        # failed"), most often on deep pages. Treat it as an empty page so the
        # caller retries a different (shallower) page instead of aborting the
        # whole build.
        msg = f"⚠️  Funda search failed on page {page}: {exc}"
        logger.warning(msg)
        print(msg, file=sys.stderr, flush=True)
        return []
    return [r for r in results if _is_valid_buy_listing(r)]


def _pick_listing_detail(
    client: Any,
    candidates: list[Any],
    *,
    min_price: int,
    max_price: int | None,
) -> Any | None:
    """Fetch and validate listing detail, ensuring price is within range."""
    shuffled = list(candidates)
    random.shuffle(shuffled)
    for pick in shuffled[: min(_DETAIL_PICK_LIMIT, len(shuffled))]:
        try:
            detail = client.listing(pick.global_id or pick.id)
        except Exception:
            continue
        if not _is_valid_buy_listing(detail, strict_existing=True):
            continue
        amount = detail.price.amount
        if not amount:
            continue
        if amount < min_price or (max_price is not None and amount >= max_price):
            continue
        return detail
    return None


def _candidates_from_random_page(
    client: Any,
    *,
    min_price: int,
    max_price: int | None,
) -> list[Any]:
    upper = _MAX_SEARCH_PAGE
    for _ in range(_PAGE_ATTEMPTS):
        page = random.randint(0, upper)
        candidates = _search_candidates(client, min_price=min_price, max_price=max_price, page=page)
        if candidates:
            return candidates
        if page == 0:
            break
        upper = min(upper, max(0, page - 1))
    return []


def fetch_random_listing() -> Any:
    """Pick a buy listing"""
    from funda import Funda

    primary = _pick_price_bucket()

    fallbacks = [(lo, hi) for lo, hi, _ in _PRICE_BUCKETS if (lo, hi) != primary]
    random.shuffle(fallbacks)

    with Funda() as client:
        for i, (min_price, max_price) in enumerate((primary, *fallbacks)):
            for _ in range(_PAGE_ATTEMPTS):
                candidates = _candidates_from_random_page(client, min_price=min_price, max_price=max_price)
                if not candidates:
                    continue
                detail = _pick_listing_detail(client, candidates, min_price=min_price, max_price=max_price)
                if detail is not None:
                    if i > 0:
                        max_price_str = f"€{max_price:,}" if max_price else "∞"
                        msg = (
                            f"⚠️  No listings in primary bucket, fell back to "
                            f"€{min_price:,}–{max_price_str}. Consider adjusting PRICE_BUCKETS."
                        )
                        logger.warning(msg)
                        print(msg, file=sys.stderr, flush=True)
                    return detail

        for _ in range(_PAGE_ATTEMPTS):
            page = random.randint(0, _MAX_SEARCH_PAGE)
            candidates = _search_candidates(client, min_price=None, max_price=None, page=page)
            if not candidates:
                continue
            detail = _pick_listing_detail(client, candidates, min_price=100_000, max_price=None)
            if detail is not None:
                return detail

        raise RuntimeError("Could not load existing-build listing from search results")


def _payload_needs_funda_refresh(payload: dict[str, Any]) -> bool:
    """True when stored Funda metadata is incomplete or likely stale."""
    if not payload.get("detail_path"):
        return True
    urls = payload.get("photo_urls") or []
    if not urls:
        return True
    stored_count = payload.get("photo_count")
    if isinstance(stored_count, int) and stored_count > len(urls):
        return True
    if len(urls) <= SEARCH_THUMB_PHOTO_LIMIT:
        return True
    url = funda_listing_url(payload)
    path = payload.get("detail_path")
    if isinstance(path, str) and url and not url.rstrip("/").endswith(path.rstrip("/")):
        return True
    tiny = payload.get("tiny_id")
    if tiny and url:
        url_id = url.rstrip("/").split("/")[-1]
        if url_id != str(tiny):
            return True
    return False


def _enrich_payload_from_funda(payload: dict[str, Any]) -> dict[str, Any]:
    """Refresh URL, ids, and photos from the live Funda listing API."""
    listing_id = payload.get("global_id") or payload.get("tiny_id")
    if not listing_id:
        return payload
    try:
        from funda import Funda

        with Funda() as client:
            listing = client.listing(listing_id)
        fresh = listing_to_payload(listing)
        merged = {**payload, **fresh}
        return merged
    except Exception:
        return payload


def build_live_puzzle(puzzle_date: date) -> tuple[int, int, dict]:
    del puzzle_date  # listing selection is random; date is only for storage
    listing = fetch_random_listing()
    amount = listing.price.amount
    if amount is None:
        raise RuntimeError("Listing has no price")
    city = listing.city or "Unknown"
    # GitHub Actions logs are public; never print the answer there. Locally the
    # price is handy for debugging.
    price_str = "€<hidden>" if os.environ.get("GITHUB_ACTIONS") == "true" else f"€{amount:,}"
    print(f"\033[92m✓ Puzzle: {price_str} ({city})\033[0m", file=sys.stderr, flush=True)
    return listing.global_id or int(listing.id), amount, listing_to_payload(listing)


def _clear_sessions_for_date(db: Session, puzzle_date: date) -> None:
    for row in db.scalars(select(GameSession).where(GameSession.puzzle_date == puzzle_date)):
        db.delete(row)
    db.commit()


def ensure_puzzle_for_date(
    db: Session,
    puzzle_date: date,
    *,
    force: bool = False,
) -> DailyPuzzle:
    existing = db.get(DailyPuzzle, puzzle_date)
    if existing and not force:
        if _payload_needs_funda_refresh(existing.payload):
            updated = _enrich_payload_from_funda(dict(existing.payload))
            if funda_listing_url(updated) or updated.get("photo_urls"):
                existing.payload = updated
                db.commit()
                db.refresh(existing)
        return existing

    if force and existing:
        _clear_sessions_for_date(db, puzzle_date)

    global_id, answer, payload = build_live_puzzle(puzzle_date)

    if existing:
        existing.global_id = global_id
        existing.answer_eur = answer
        existing.payload = payload
        db.commit()
        db.refresh(existing)
        return existing

    row = DailyPuzzle(
        puzzle_date=puzzle_date,
        global_id=global_id,
        answer_eur=answer,
        payload=payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
