#!/usr/bin/env python3
"""Generate real city-mode fixtures from live Funda for offline testing.

Fetches one real currently-listed property per city and writes
apps/web/lib/__fixtures__/cityPuzzles.json, so NEXT_PUBLIC_CITY_LOCAL=1 serves
real photos/hints/prices without Funda or Supabase. Re-run when the fixtures go
stale (listings sell): `python scripts/gen_city_fixtures.py`.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")

from app.services.city_puzzle_builder import (  # noqa: E402
    CITY_MODE_CITIES,
    build_city_live_puzzle,
)

OUT = ROOT / "apps" / "web" / "lib" / "__fixtures__" / "cityPuzzles.json"


def main() -> None:
    cities: dict[str, dict] = {}
    for city in CITY_MODE_CITIES:
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                _global_id, answer, payload = build_city_live_puzzle(city)
                cities[city.key] = {"answer_eur": answer, "payload": payload}
                print(
                    f"  {city.display}: €{answer:,} ({payload.get('photo_count')} foto's)",
                    file=sys.stderr,
                )
                break
            except Exception as exc:  # transient Funda failures — retry
                last_err = exc
                print(f"  {city.display}: attempt {attempt + 1} failed ({exc})", file=sys.stderr)
        else:
            raise RuntimeError(f"Could not fetch a listing for {city.key}") from last_err

    data = {
        "_comment": (
            "Real Funda listings baked for offline city-mode testing "
            "(NEXT_PUBLIC_CITY_LOCAL=1). Regenerate with scripts/gen_city_fixtures.py "
            "when listings go stale."
        ),
        "cities": cities,
    }
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(cities)} cities)")


if __name__ == "__main__":
    main()
