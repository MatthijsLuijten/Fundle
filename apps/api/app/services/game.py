"""Game session logic and guess evaluation."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DailyPuzzle, GameSession
from app.services.hints import (
    MAX_GUESSES,
    MAX_HINT_LEVEL,
    format_listed_ago,
    humanize_hints,
    hints_for_level,
    new_hints_for_level,
)
from app.puzzle_date import today_date
from app.services.funda_url import funda_listing_url
from app.services.puzzle_builder import ensure_puzzle_for_date

TOLERANCE_PCT = 0.02  # within 2% counts as correct


def puzzle_number_for_date(puzzle_date: date) -> int:
    epoch = date(2026, 1, 1)
    return (puzzle_date - epoch).days + 1


PHOTOS_PER_GUESS = 2
UNLOCK_PHOTO_SLOTS = PHOTOS_PER_GUESS * MAX_GUESSES


def _photo_pool(payload: dict) -> list[str]:
    urls = [u for u in (payload.get("photo_urls") or []) if u]
    if urls:
        return urls
    single = payload.get("photo_url")
    return [single] if single else []


def _index_at_percentile(slot: int, total_slots: int, count: int) -> int:
    """Map unlock slot 1..total_slots across indices 1..count-1 (0 is the hero photo)."""
    if count <= 1:
        return 0
    return min(count - 1, max(1, (slot * (count - 1)) // (total_slots + 1)))


def _nearest_unused_index(target: int, count: int, used: set[int]) -> int:
    if target not in used:
        return target
    for offset in range(1, count):
        for candidate in (target + offset, target - offset):
            if 0 <= candidate < count and candidate not in used:
                return candidate
    return target


def _pick_indices_at_percentiles(
    count: int,
    slots: int,
    used: set[int],
) -> list[int]:
    picked: list[int] = []
    for slot in range(1, slots + 1):
        target = _index_at_percentile(slot, slots, count)
        index = _nearest_unused_index(target, count, used)
        if index in used:
            continue
        used.add(index)
        picked.append(index)
    return picked


def _build_photo_order(payload: dict) -> list[str]:
    """First listing photo, then two spread picks per guess across the full gallery."""
    pool = _photo_pool(payload)
    if not pool:
        return []
    if len(pool) == 1:
        return pool

    used: set[int] = {0}
    indices = [0]
    unlock_slots = min(UNLOCK_PHOTO_SLOTS, len(pool) - 1)
    indices.extend(_pick_indices_at_percentiles(len(pool), unlock_slots, used))
    return [pool[i] for i in indices]


def revealed_photos(session: GameSession, payload: dict) -> list[str]:
    """Start with photo 1; each guess unlocks two more percentile picks."""
    order = list(session.photo_order or [])
    if not order:
        return []
    if session.status == "won":
        return order
    unlocked = 1 + PHOTOS_PER_GUESS * len(session.guesses)
    return order[: min(unlocked, len(order))]


def _delete_session(db: Session, session_id: str, puzzle_date: date) -> None:
    stmt = select(GameSession).where(
        GameSession.session_id == session_id,
        GameSession.puzzle_date == puzzle_date,
    )
    row = db.execute(stmt).scalar_one_or_none()
    if row:
        db.delete(row)
        db.commit()


def _photo_order_valid(order: list[str], pool: list[str]) -> bool:
    if not pool:
        return not order
    if not order:
        return False
    pool_set = set(pool)
    return all(url in pool_set for url in order)


def _reset_session_for_listing(
    session: GameSession, payload: dict, listing_global_id: int
) -> None:
    session.guesses = []
    session.hint_level = 0
    session.status = "playing"
    session.photo_order = _build_photo_order(payload)
    session.listing_global_id = listing_global_id


def _sync_session_with_puzzle(
    db: Session, session: GameSession, puzzle: DailyPuzzle
) -> GameSession:
    payload = puzzle.payload
    pool = _photo_pool(payload)
    order = list(session.photo_order or [])
    expected = _build_photo_order(payload)
    listing_changed = session.listing_global_id != puzzle.global_id
    order_stale = bool(order) and not _photo_order_valid(order, pool)
    order_mismatch = bool(order) and order != expected

    if listing_changed:
        _reset_session_for_listing(session, payload, puzzle.global_id)
        db.commit()
        db.refresh(session)
        return session

    if order_stale or order_mismatch or (not order and pool):
        session.photo_order = expected
        session.listing_global_id = puzzle.global_id
        db.commit()
        db.refresh(session)
    elif session.listing_global_id is None:
        session.listing_global_id = puzzle.global_id
        db.commit()
        db.refresh(session)

    return session


def clear_sessions_for_date(db: Session, puzzle_date: date) -> int:
    rows = list(
        db.scalars(select(GameSession).where(GameSession.puzzle_date == puzzle_date))
    )
    for row in rows:
        db.delete(row)
    db.commit()
    return len(rows)


def get_or_create_session(
    db: Session,
    session_id: str | None,
    puzzle_date: date,
    *,
    fresh: bool = False,
) -> GameSession:
    if fresh:
        ensure_puzzle_for_date(db, puzzle_date, force=True)
    else:
        ensure_puzzle_for_date(db, puzzle_date)

    sid = session_id or str(uuid.uuid4())

    if fresh and session_id:
        _delete_session(db, sid, puzzle_date)

    stmt = select(GameSession).where(
        GameSession.session_id == sid,
        GameSession.puzzle_date == puzzle_date,
    )
    row = db.execute(stmt).scalar_one_or_none()
    puzzle = db.get(DailyPuzzle, puzzle_date)
    payload = puzzle.payload if puzzle else {}

    if row and puzzle:
        return _sync_session_with_puzzle(db, row, puzzle)
    if row:
        return row

    row = GameSession(
        session_id=sid,
        puzzle_date=puzzle_date,
        guesses=[],
        photo_order=_build_photo_order(payload),
        listing_global_id=puzzle.global_id if puzzle else None,
        hint_level=0,
        status="playing",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def evaluate_guess(answer: int, guess: int) -> tuple[bool, str | None, int]:
    if answer == 0:
        return guess == answer, None, 0
    delta = guess - answer
    pct_diff = abs(delta) / answer
    if pct_diff <= TOLERANCE_PCT:
        return True, None, abs(delta)
    direction = "high" if delta > 0 else "low"
    return False, direction, abs(delta)


def community_stats(db: Session, puzzle_date: date) -> dict[str, int]:
    finished = db.scalar(
        select(func.count()).where(
            GameSession.puzzle_date == puzzle_date,
            GameSession.status.in_(("won", "lost")),
        )
    ) or 0
    won = db.scalar(
        select(func.count()).where(
            GameSession.puzzle_date == puzzle_date,
            GameSession.status == "won",
        )
    ) or 0
    return {"finished": finished, "won": won}


def result_payload(db: Session, puzzle: DailyPuzzle, won: bool) -> dict:
    stats = community_stats(db, puzzle.puzzle_date)
    return {
        "won": won,
        "answer_eur": puzzle.answer_eur,
        "formatted_price": f"€{puzzle.answer_eur:,}".replace(",", "."),
        "url": funda_listing_url(puzzle.payload),
        "city": puzzle.payload.get("city"),
        "listed_ago": format_listed_ago(puzzle.payload.get("publication_date")),
        "community_finished": stats["finished"],
        "community_won": stats["won"],
    }


def session_state(
    db: Session,
    session: GameSession,
    *,
    guess_correct: bool = False,
    guess_direction: str | None = None,
) -> dict:
    puzzle = db.get(DailyPuzzle, session.puzzle_date)
    if not puzzle:
        raise RuntimeError("Puzzle missing")

    guesses_out = [
        {
            "amount": g["amount"],
            "direction": g.get("direction"),
        }
        for g in session.guesses
    ]

    result = None
    if session.status in ("won", "lost"):
        result = result_payload(db, puzzle, session.status == "won")

    hint_level = (
        MAX_HINT_LEVEL
        if session.status in ("won", "lost")
        else session.hint_level
    )
    raw_hints = hints_for_level(puzzle.payload, hint_level)
    photos = revealed_photos(session, puzzle.payload)
    guesses_count = len(session.guesses)
    new_photo_urls: list[str] = []
    if guesses_count > 0:
        prev_unlocked = 1 + PHOTOS_PER_GUESS * (guesses_count - 1)
        if session.status == "won":
            new_photo_urls = photos[prev_unlocked:]
        else:
            unlocked = 1 + PHOTOS_PER_GUESS * guesses_count
            new_photo_urls = photos[prev_unlocked:unlocked]

    return {
        "puzzle_date": session.puzzle_date,
        "puzzle_number": puzzle_number_for_date(session.puzzle_date),
        "session_id": session.session_id,
        "correct": guess_correct,
        "direction": guess_direction,
        "guesses_used": len(session.guesses),
        "max_guesses": MAX_GUESSES,
        "hint_level": hint_level,
        "status": session.status,
        "hints": humanize_hints(raw_hints),
        "new_hints": new_hints_for_level(
            puzzle.payload, session.hint_level, guesses_count, status=session.status
        ),
        "new_photo_urls": new_photo_urls,
        "revealed_photos": photos,
        "guesses": guesses_out,
        "result": result,
    }


def submit_guess(db: Session, session_id: str | None, amount: int) -> dict:
    puzzle_date = today_date()
    session = get_or_create_session(db, session_id, puzzle_date)

    if session.status != "playing":
        return session_state(db, session)

    puzzle = db.get(DailyPuzzle, puzzle_date)
    if not puzzle:
        raise RuntimeError("Puzzle missing")

    correct, direction, delta = evaluate_guess(puzzle.answer_eur, amount)
    guess_record = {"amount": amount, "direction": direction, "delta_eur": delta}
    session.guesses = [*session.guesses, guess_record]

    if correct:
        session.status = "won"
        session.hint_level = MAX_HINT_LEVEL
    elif len(session.guesses) >= MAX_GUESSES:
        session.status = "lost"
    else:
        session.hint_level = min(session.hint_level + 1, 4)

    db.commit()
    db.refresh(session)
    return session_state(
        db, session, guess_correct=correct, guess_direction=direction
    )
