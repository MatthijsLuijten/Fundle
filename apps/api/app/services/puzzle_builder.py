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

from app.services.hints import listing_to_payload

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent.parent / ".env")


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


# Funda put Firebase App Check in front of their search backend on 2026-08-18,
# so every client.search() call now 401s with "no token provided" and no amount
# of retrying helps (https://github.com/0xMH/pyfunda/issues/15). The
# listing-detail endpoint is still open, and Funda global_ids are close enough
# to sequential that we can discover listings by sampling ids directly instead.
#
# _ID_SEED is a range known to contain live listings; ids only ever grow, so we
# probe upward from it to find the current frontier and sample the window below
# that. Bump the seed occasionally to keep the probe short.
_ID_SEED = 8_100_000
_ID_PROBE_STEP = 25_000
_ID_PROBE_BATCH = 8
_ID_PROBE_LEVELS = 40
# How far below the frontier to sample. Listings stay for sale for months, so a
# narrow window would keep re-picking the same fresh listings.
_ID_WINDOW = 500_000
# Detail fetches per build. Empirically ~1 in 15 sampled ids is an available
# buy listing, so this comfortably fills the bucket in a normal run.
_SAMPLE_ATTEMPTS = 400
_PAGE_ATTEMPTS = 8

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


def _in_bucket(amount: int | None, min_price: int, max_price: int | None) -> bool:
    if amount is None:
        return False
    return amount >= min_price and (max_price is None or amount < max_price)


def _listing_exists(client: Any, global_id: int) -> Any | None:
    try:
        return client.listing(global_id)
    except Exception:
        # 404 is the common case (id never issued, or listing withdrawn); a
        # transient error is equally fine to skip, the caller just samples on.
        return None


def _global_id_frontier(client: Any) -> int:
    """Highest global_id band that still resolves, probed upward from _ID_SEED.

    Funda hands out global_ids in ascending order, so everything below the
    frontier is fair game and everything above it 404s. A band counts as live
    if any of _ID_PROBE_BATCH random ids inside it resolves.
    """
    frontier = _ID_SEED
    for _ in range(_ID_PROBE_LEVELS):
        top = frontier + _ID_PROBE_STEP
        if not any(
            _listing_exists(client, random.randint(frontier, top)) is not None
            for _ in range(_ID_PROBE_BATCH)
        ):
            return frontier
        frontier = top
    return frontier


def _iter_sampled_listings(client: Any, attempts: int) -> Any:
    """Yield valid, currently-available buy listings found by random id sampling."""
    frontier = _global_id_frontier(client)
    low = max(1, frontier - _ID_WINDOW)
    for _ in range(attempts):
        detail = _listing_exists(client, random.randint(low, frontier))
        if detail is None:
            continue
        # Search used to return only live listings; sampling ids does not, so
        # sold / under-offer listings have to be filtered out explicitly.
        if getattr(detail, "status", None) != "available":
            continue
        if not _is_valid_buy_listing(detail, strict_existing=True):
            continue
        yield detail


def fetch_random_listing() -> Any:
    """Pick a buy listing"""
    from funda import Funda

    min_price, max_price = _pick_price_bucket()
    floor = min(lo for lo, _, _ in _PRICE_BUCKETS)
    off_bucket: list[Any] = []

    with Funda() as client:
        for detail in _iter_sampled_listings(client, _SAMPLE_ATTEMPTS):
            if _in_bucket(detail.price.amount, min_price, max_price):
                return detail
            if _in_bucket(detail.price.amount, floor, None):
                off_bucket.append(detail)

    if off_bucket:
        max_price_str = f"€{max_price:,}" if max_price else "∞"
        msg = (
            f"⚠️  No sampled listing in primary bucket €{min_price:,}–{max_price_str} "
            f"after {_SAMPLE_ATTEMPTS} probes; falling back to one of "
            f"{len(off_bucket)} other listings. Consider adjusting PRICE_BUCKETS."
        )
        logger.warning(msg)
        print(msg, file=sys.stderr, flush=True)
        return random.choice(off_bucket)

    raise RuntimeError("Could not load existing-build listing from sampled global_ids")



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
