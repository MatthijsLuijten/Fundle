#!/usr/bin/env python3
"""Build the city-mode puzzle for a date and publish it to Supabase.

City mode plays one city per day, picked by city_for_date, so a normal run
authors a single city_puzzles row with closes_at = 18:00 Europe/Amsterdam on the
puzzle date. Idempotent per (city, date): skips a city that already has a puzzle
unless --force. Pass --city to build a different city than the day's own, which
only makes sense for backfills and manual fixes.

Usage:
  python build_city_puzzles.py [--date YYYY-MM-DD] [--force] [--city SLUG]
  python build_city_puzzles.py --dry-run [--city SLUG]   # live Funda, no Supabase

Requires env (apps/api/.env locally, or GitHub Actions secrets):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (not needed for --dry-run)
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")

import httpx  # noqa: E402

from app.obfuscate import obfuscate  # noqa: E402
from app.puzzle_date import today_date  # noqa: E402
from app.services.city_puzzle_builder import (  # noqa: E402
    CITIES_BY_KEY,
    City,
    build_city_live_puzzle,
    city_for_date,
    reveal_time_for_date,
)

PUZZLE_EPOCH = date(2026, 1, 1)


def puzzle_number_for_date(puzzle_date: date) -> int:
    return (puzzle_date - PUZZLE_EPOCH).days + 1


def _require_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)
    return url.rstrip("/"), key


def _puzzle_exists(base_url: str, headers: dict, city: City, puzzle_date: date) -> bool:
    resp = httpx.get(
        f"{base_url}/rest/v1/city_puzzles",
        params={
            "city": f"eq.{city.key}",
            "puzzle_date": f"eq.{puzzle_date}",
            "select": "city",
        },
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return bool(resp.json())


def _build_and_upsert(base_url: str, headers: dict, city: City, puzzle_date: date) -> None:
    global_id, answer, payload = build_city_live_puzzle(city)
    row = {
        "city": city.key,
        "puzzle_date": puzzle_date.isoformat(),
        "puzzle_number": puzzle_number_for_date(puzzle_date),
        "global_id": global_id,
        "answer_token": obfuscate(answer),
        "closes_at": reveal_time_for_date(puzzle_date).isoformat(),
        "payload": payload,
    }
    resp = httpx.post(
        f"{base_url}/rest/v1/city_puzzles",
        params={"on_conflict": "city,puzzle_date"},
        headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=row,
        timeout=60,
    )
    resp.raise_for_status()
    print(
        f"✓ Published {city.display} {puzzle_date}: global_id={global_id} "
        f"answer=€{answer:,} closes={row['closes_at']}"
    )


def _selected_city(city_arg: str | None, puzzle_date: date) -> City:
    if city_arg is None:
        return city_for_date(puzzle_date)
    city = CITIES_BY_KEY.get(city_arg)
    if city is None:
        print(
            f"❌ Unknown city {city_arg!r}. Options: {', '.join(CITIES_BY_KEY)}",
            file=sys.stderr,
        )
        sys.exit(1)
    return city


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Fundle city puzzles")
    parser.add_argument("--date", type=date.fromisoformat, default=None)
    parser.add_argument("--force", action="store_true", help="Replace existing puzzles")
    parser.add_argument(
        "--city",
        default=None,
        help="Build this city instead of the one whose turn it is (backfills, fixes)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dev: build from live Funda and print JSON, no Supabase writes",
    )
    args = parser.parse_args()

    puzzle_date = args.date or today_date()
    city = _selected_city(args.city, puzzle_date)

    if args.dry_run:
        global_id, answer, payload = build_city_live_puzzle(city)
        print(
            json.dumps(
                {
                    "city": city.key,
                    "global_id": global_id,
                    "answer_eur": answer,
                    "closes_at": reveal_time_for_date(puzzle_date).isoformat(),
                    "payload_city": payload.get("city"),
                    "photo_count": payload.get("photo_count"),
                }
            )
        )
        return

    base_url, key = _require_env()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    if not args.force and _puzzle_exists(base_url, headers, city, puzzle_date):
        print(f"{city.display} {puzzle_date} already exists; skipping.")
        return

    try:
        _build_and_upsert(base_url, headers, city, puzzle_date)
    except Exception as exc:
        print(f"❌ {city.display} failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
