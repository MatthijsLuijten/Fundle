#!/usr/bin/env python3
"""Build or refresh the daily puzzle. Run via cron once per day."""

import argparse
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from dotenv import load_dotenv

load_dotenv(API_ROOT / ".env")

from app.database import SessionLocal
from app.services.game import clear_sessions_for_date
from app.services.puzzle_builder import ensure_puzzle_for_date


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Fundle daily puzzle")
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--force", action="store_true", help="Replace existing puzzle")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        row = ensure_puzzle_for_date(db, args.date, force=args.force)
        if args.force:
            cleared = clear_sessions_for_date(db, args.date)
            if cleared:
                print(f"Cleared {cleared} session(s) for {args.date}.")
        print(
            f"Puzzle {row.puzzle_date}: global_id={row.global_id} "
            f"answer=€{row.answer_eur:,} city={row.payload.get('city')}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
