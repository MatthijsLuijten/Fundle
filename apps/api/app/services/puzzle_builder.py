"""Fetch listings from Funda and build daily puzzles."""

from __future__ import annotations

import random
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import DailyPuzzle, GameSession
from app.services.funda_url import funda_listing_url
from app.services.hints import listing_to_payload

# Funda search results only include ~5 thumbnail ids; detail has the full gallery.
SEARCH_THUMB_PHOTO_LIMIT = 6

DEMO_LISTING_ID = 7762080

DEMO_PAYLOAD: dict[str, Any] = {
    "global_id": DEMO_LISTING_ID,
    "tiny_id": "43117443",
    "url": None,
    "offering_type": "buy",
    "object_type": "apartment",
    "construction_type": "existing",
    "city": "Luttenberg",
    "province": "Overijssel",
    "municipality": "Raalte",
    "neighbourhood": "Luttenberg",
    "living_area": 85,
    "plot_area": None,
    "energy_label": "B",
    "bedrooms": 3,
    "rooms_count": 4,
    "construction_year": 1998,
    "house_type": "Bovenwoning",
    "photo_url": None,
    "photo_urls": [],
    "feature_flags": ["garden"],
    "highlight": None,
}

DEMO_ANSWER = 695_000


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


# Nationwide search: random sort + page spreads picks across the full catalog.
_MAX_RANDOM_PAGE = 100
_SEARCH_ATTEMPTS = 6


def _search_candidates(client: Any, *, sort: str, page: int) -> list[Any]:
    results = client.search(category="buy", sort=sort, page=page)
    return [r for r in results if _is_valid_buy_listing(r)]


def fetch_random_listing() -> Any:
    from funda import Funda
    from funda.constants import SORT_OPTIONS

    sorts = list(SORT_OPTIONS)
    with Funda() as client:
        candidates: list[Any] = []
        for _ in range(_SEARCH_ATTEMPTS):
            sort = random.choice(sorts)
            page = random.randint(0, _MAX_RANDOM_PAGE)
            candidates = _search_candidates(client, sort=sort, page=page)
            if candidates:
                break

        if not candidates:
            candidates = _search_candidates(client, sort="newest", page=0)
        if not candidates:
            raise RuntimeError("No buy listings found on Funda")

        random.shuffle(candidates)
        for pick in candidates[: min(20, len(candidates))]:
            try:
                detail = client.listing(pick.global_id or pick.id)
            except Exception:
                continue
            if _is_valid_buy_listing(detail, strict_existing=True) and detail.price.amount:
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


def build_demo_puzzle(puzzle_date: date) -> tuple[int, int, dict]:
    base = dict(DEMO_PAYLOAD)
    payload = _enrich_payload_from_funda(base)
    global_id = payload.get("global_id") or DEMO_LISTING_ID
    return global_id, DEMO_ANSWER, payload


def build_live_puzzle(puzzle_date: date) -> tuple[int, int, dict]:
    listing = fetch_random_listing()
    amount = listing.price.amount
    if amount is None:
        raise RuntimeError("Listing has no price")
    return listing.global_id or int(listing.id), amount, listing_to_payload(listing)


def _clear_sessions_for_date(db: Session, puzzle_date: date) -> None:
    for row in db.scalars(
        select(GameSession).where(GameSession.puzzle_date == puzzle_date)
    ):
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

    if settings.demo_mode:
        global_id, answer, payload = build_demo_puzzle(puzzle_date)
    else:
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
