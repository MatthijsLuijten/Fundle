#!/usr/bin/env python3
"""Build daily puzzles and publish them to Supabase. Run via cron once per day.

Default run ensures a puzzle exists for **today** (backfill safety net) and
**tomorrow** (pre-build), so the new puzzle is already in the database when the
Amsterdam date flips at midnight. Idempotent: existing dates are skipped, and
transient Funda failures are retried with backoff.

Usage:
  python build_daily_puzzle.py                    # ensure today + tomorrow
  python build_daily_puzzle.py --date YYYY-MM-DD  # single date
  python build_daily_puzzle.py --force            # rebuild today (or --date)
  python build_daily_puzzle.py --random   # dev: live Funda pick, JSON on stdout, no DB

Requires env (loaded from apps/api/.env locally, or GitHub Actions secrets):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not needed for --random)
  PRICE_BUCKETS (optional)
"""

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
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

# Funda's search backend fails transiently (~1 in 5 runs historically); a
# fresh attempt almost always succeeds. Retry the whole build with backoff
# before letting the job fail: 30s + 60s + 120s ≈ 3.5 min worst case.
BUILD_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 30


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


def _build_with_retry(puzzle_date: date) -> tuple[int, int, dict]:
    for attempt in range(1, BUILD_ATTEMPTS + 1):
        try:
            return build_live_puzzle(puzzle_date)
        except Exception as exc:
            if attempt == BUILD_ATTEMPTS:
                raise
            wait = BACKOFF_BASE_SECONDS * 2 ** (attempt - 1)
            print(
                f"⚠️  Build attempt {attempt}/{BUILD_ATTEMPTS} failed ({exc}); retrying in {wait}s...",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(wait)
    raise AssertionError("unreachable")


def _build_and_upsert(base_url: str, headers: dict, puzzle_date: date) -> None:
    global_id, answer, payload = _build_with_retry(puzzle_date)
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
        help="Build only this date (default: ensure today and tomorrow, Europe/Amsterdam)",
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

    if args.date is not None:
        puzzle_dates = [args.date]
    elif args.force:
        # Bare --force keeps its historical meaning: rebuild today only.
        puzzle_dates = [today_date()]
    else:
        # Backfill today if somehow missing, then pre-build tomorrow so the
        # new puzzle is live the moment the Amsterdam date flips.
        puzzle_dates = [today_date(), today_date() + timedelta(days=1)]

    for puzzle_date in puzzle_dates:
        if not args.force and _puzzle_exists(base_url, headers, puzzle_date):
            print(f"Puzzle for {puzzle_date} already exists; skipping (use --force to rebuild).")
            continue
        _build_and_upsert(base_url, headers, puzzle_date)


if __name__ == "__main__":
    main()
