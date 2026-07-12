#!/usr/bin/env python3
"""Build the daily puzzle and publish it to Supabase. Run via cron once per day.

Idempotent: skips when a puzzle already exists for the date unless --force.

Usage:
  python build_daily_puzzle.py [--date YYYY-MM-DD] [--force]
  python build_daily_puzzle.py --random   # dev: live Funda pick, JSON on stdout, no DB

Requires env (loaded from apps/api/.env locally, or GitHub Actions secrets):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not needed for --random)
  PRICE_BUCKETS (optional)
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

# Imports below run after sys.path/.env setup above, hence the E402 suppressions.
from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")

import httpx  # noqa: E402

from app.obfuscate import obfuscate  # noqa: E402
from app.puzzle_date import today_date  # noqa: E402
from app.services.puzzle_builder import build_live_puzzle  # noqa: E402

PUZZLE_EPOCH = date(2026, 1, 1)


def puzzle_number_for_date(puzzle_date: date) -> int:
    return (puzzle_date - PUZZLE_EPOCH).days + 1


def _require_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
            file=sys.stderr,
        )
        sys.exit(1)
    return url.rstrip("/"), key


def _puzzle_exists(base_url: str, headers: dict, puzzle_date: date) -> bool:
    resp = httpx.get(
        f"{base_url}/rest/v1/daily_puzzles",
        params={"puzzle_date": f"eq.{puzzle_date}", "select": "puzzle_date"},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return bool(resp.json())


def _build_and_upsert(base_url: str, headers: dict, puzzle_date: date) -> None:
    global_id, answer, payload = build_live_puzzle(puzzle_date)
    row = {
        "puzzle_date": puzzle_date.isoformat(),
        "puzzle_number": puzzle_number_for_date(puzzle_date),
        "global_id": global_id,
        "answer_token": obfuscate(answer),
        "payload": payload,
    }
    resp = httpx.post(
        f"{base_url}/rest/v1/daily_puzzles",
        headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=row,
        timeout=60,
    )
    resp.raise_for_status()
    # GitHub Actions logs are public; never print the answer there. The
    # global_id also reveals the price (it resolves to the Funda listing), so
    # hide it too; city alone is enough for devs to cross-reference.
    in_ci = os.environ.get("GITHUB_ACTIONS") == "true"
    answer_str = "€<hidden>" if in_ci else f"€{answer:,}"
    global_id_str = "<hidden>" if in_ci else str(global_id)
    print(
        f"✓ Published puzzle {puzzle_date}: #{row['puzzle_number']} "
        f"global_id={global_id_str} answer={answer_str} city={payload.get('city')}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Fundle daily puzzle")
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=None,
        help="Puzzle date (default: today in Europe/Amsterdam)",
    )
    parser.add_argument("--force", action="store_true", help="Replace existing puzzle")
    parser.add_argument(
        "--random",
        action="store_true",
        help="Dev only: fetch one live random Funda listing (JSON on stdout, no Supabase)",
    )
    args = parser.parse_args()

    if args.random:
        global_id, answer, payload = build_live_puzzle(today_date())
        print(json.dumps({"global_id": global_id, "answer_token": obfuscate(answer), "payload": payload}))
        return

    base_url, key = _require_env()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    puzzle_date = args.date or today_date()
    if not args.force and _puzzle_exists(base_url, headers, puzzle_date):
        print(f"Puzzle for {puzzle_date} already exists; skipping (use --force to rebuild).")
        return

    _build_and_upsert(base_url, headers, puzzle_date)


if __name__ == "__main__":
    main()
