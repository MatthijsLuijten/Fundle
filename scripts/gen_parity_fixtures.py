#!/usr/bin/env python3
"""Generate cross-language parity fixtures for the TS game engine.

Runs the canonical backend logic (apps/api/app/services/game.py + hints.py) over
a fixed payload and several guess sequences, and writes the resulting PuzzleState
snapshots to apps/web/lib/__fixtures__/parity.json. The vitest parity test asserts
that apps/web/lib/engine.ts produces byte-identical output.

Re-run after changing game logic on either side:  python scripts/gen_parity_fixtures.py
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from datetime import date

from app.services.funda_url import funda_listing_url
from app.services.game import (
    MAX_GUESSES,
    _build_photo_order,
    _unlocked_photo_count,
    evaluate_guess,
    puzzle_number_for_date,
    revealed_photos,
)
from app.services.hints import (
    MAX_HINT_LEVEL,
    format_listed_ago,
    hints_for_level,
    humanize_hints,
    new_hints_for_level,
)

OUT = ROOT / "apps" / "web" / "lib" / "__fixtures__" / "parity.json"
PUZZLE_DATE = date(2026, 3, 15)
ANSWER_EUR = 500_000
SESSION_ID = "test-session"

PAYLOAD = {
    "global_id": 4242,
    "tiny_id": "abc123",
    "url": "https://www.funda.nl/detail/koop/amsterdam/huis-keizersgracht-1-1015cn/4242/",
    "detail_path": "/detail/koop/amsterdam/huis-keizersgracht-1-1015cn/4242/",
    "object_type": "house",
    "city": "Amsterdam",
    "province": "Noord-Holland",
    "municipality": "Amsterdam",
    "neighbourhood": "Grachtengordel",
    "living_area": 125,
    "plot_area": 90,
    "energy_label": "A",
    "bedrooms": 3,
    "rooms_count": 5,
    "construction_year": 1890,
    "house_type": "Grachtenpand",
    "insulation": "Dubbel glas",
    "sustainability_measures": ["Zonnepanelen", "Warmtepomp"],
    "publication_date": "2026-03-01T00:00:00Z",  # 14 days before PUZZLE_DATE -> "2 weken online"
    "photo_url": "https://cdn/p0.jpg",
    "photo_urls": [f"https://cdn/p{i}.jpg" for i in range(12)],
    "photo_count": 12,
}

# Guess sequences (amount per guess).
SCENARIOS = {
    "win_guess_3": [400_000, 600_000, 505_000],
    # 4 wrong guesses, final guess still pending: the remaining photos front-load
    # onto the last guess instead of appearing uselessly after it.
    "in_progress_4": [300_000, 320_000, 340_000, 360_000],
    "loss_after_5": [300_000, 320_000, 340_000, 360_000, 380_000],
    "win_guess_1": [500_000],
    "in_progress_2": [420_000, 580_000],
}


def simulate(amounts: list[int]) -> dict:
    guesses: list[dict] = []
    status = "playing"
    hint_level = 0
    last = {"correct": False, "direction": None}

    for amount in amounts:
        if status != "playing":
            break
        correct, direction, delta = evaluate_guess(ANSWER_EUR, amount)
        guesses.append({"amount": amount, "direction": direction})
        last = {"correct": correct, "direction": direction}
        if correct:
            status = "won"
            hint_level = MAX_HINT_LEVEL
        elif len(guesses) >= MAX_GUESSES:
            status = "lost"
        else:
            hint_level = min(hint_level + 1, MAX_HINT_LEVEL)

    return {
        "guesses": guesses,
        "status": status,
        "hint_level": hint_level,
        "last": last,
    }


def expected_state(sim: dict) -> dict:
    guesses = sim["guesses"]
    status = sim["status"]
    hint_level = sim["hint_level"]
    guesses_count = len(guesses)
    terminal = status in ("won", "lost")

    hint_level_out = MAX_HINT_LEVEL if terminal else hint_level
    order = _build_photo_order(PAYLOAD)
    session = SimpleNamespace(photo_order=order, status=status, guesses=guesses)
    photos = revealed_photos(session, PAYLOAD)

    new_photo_urls: list[str] = []
    if guesses_count > 0:
        prev = _unlocked_photo_count(guesses_count - 1, len(order))
        if status == "won":
            new_photo_urls = photos[prev:]
        else:
            unlocked = _unlocked_photo_count(guesses_count, len(order))
            new_photo_urls = photos[prev:unlocked]

    result = None
    if terminal:
        result = {
            "won": status == "won",
            "answer_eur": ANSWER_EUR,
            "formatted_price": f"€{ANSWER_EUR:,}".replace(",", "."),
            "url": funda_listing_url(PAYLOAD),
            "city": PAYLOAD.get("city"),
            "listed_ago": format_listed_ago(
                PAYLOAD.get("publication_date"), reference=PUZZLE_DATE
            ),
            # Community counts are injected client-side from Supabase, not by the
            # engine; the engine emits zeros (see engine.ts resultPayload).
            "community_finished": 0,
            "community_won": 0,
        }

    return {
        "puzzle_date": PUZZLE_DATE.isoformat(),
        "puzzle_number": puzzle_number_for_date(PUZZLE_DATE),
        "session_id": SESSION_ID,
        "correct": sim["last"]["correct"],
        "direction": sim["last"]["direction"],
        "guesses_used": guesses_count,
        "max_guesses": MAX_GUESSES,
        "hint_level": hint_level_out,
        "status": status,
        "hints": humanize_hints(hints_for_level(PAYLOAD, hint_level_out)),
        "new_hints": new_hints_for_level(
            PAYLOAD, hint_level, guesses_count, status=status
        ),
        "new_photo_urls": new_photo_urls,
        "revealed_photos": photos,
        "guesses": guesses,
        "result": result,
    }


def main() -> None:
    fixtures = []
    for name, amounts in SCENARIOS.items():
        sim = simulate(amounts)
        fixtures.append(
            {
                "name": name,
                "puzzle": {
                    "puzzle_date": PUZZLE_DATE.isoformat(),
                    "puzzle_number": puzzle_number_for_date(PUZZLE_DATE),
                    "payload": PAYLOAD,
                    "answer_eur": ANSWER_EUR,
                },
                "game": {
                    "guesses": sim["guesses"],
                    "status": sim["status"],
                    "hint_level": sim["hint_level"],
                },
                "lastGuess": sim["last"],
                "sessionId": SESSION_ID,
                "expected": expected_state(sim),
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(fixtures, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(fixtures)} fixtures -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
