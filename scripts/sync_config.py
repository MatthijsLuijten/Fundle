#!/usr/bin/env python3
"""Sync fundle.config.env -> apps/api/.env and apps/web/.env.local."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
CONFIG = ROOT / "fundle.config.env"
API_ENV = ROOT / "apps" / "api" / ".env"
WEB_ENV = ROOT / "apps" / "web" / ".env.local"

REQUIRED = ("DEMO_MODE", "DEBUG_FRESH", "DATABASE_URL", "CORS_ORIGINS", "NEXT_PUBLIC_API_URL")


def parse_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, raw = stripped.partition("=")
        values[key.strip()] = raw.strip()
    return values


def parse_config(path: Path) -> dict[str, str]:
    if not path.is_file():
        example = path.with_name(f"{path.name}.example")
        print(f"Config not found: {path}", file=sys.stderr)
        if example.is_file():
            print(f"Copy {example.name} to {path.name} and adjust.", file=sys.stderr)
        sys.exit(1)
    return parse_env_file(path)


def write_api_env(cfg: dict[str, str]) -> None:
    missing = [k for k in REQUIRED if k not in cfg]
    if missing:
        print(f"Missing keys in {CONFIG.name}: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    content = f"""# Generated from fundle.config.env - do not edit by hand
DATABASE_URL={cfg["DATABASE_URL"]}
CORS_ORIGINS={cfg["CORS_ORIGINS"]}
DEMO_MODE={cfg["DEMO_MODE"]}
DEBUG_FRESH_SESSION={cfg["DEBUG_FRESH"]}
"""
    API_ENV.write_text(content, encoding="utf-8")


def write_web_env(cfg: dict[str, str]) -> None:
    content = f"""# Generated from fundle.config.env - do not edit by hand
NEXT_PUBLIC_API_URL={cfg["NEXT_PUBLIC_API_URL"]}
NEXT_PUBLIC_DEBUG_FRESH={cfg["DEBUG_FRESH"]}
"""
    WEB_ENV.write_text(content, encoding="utf-8")


def rebuild_today_puzzle() -> None:
    sys.path.insert(0, str(API_ROOT))
    from dotenv import load_dotenv

    load_dotenv(API_ENV, override=True)

    from app.database import SessionLocal
    from app.services.puzzle_builder import ensure_puzzle_for_date

    db = SessionLocal()
    try:
        row = ensure_puzzle_for_date(db, date.today(), force=True)
        city = row.payload.get("city", "?")
        print(f"Puzzle rebuilt: {city}, EUR {row.answer_eur:,}".replace(",", "."))
    finally:
        db.close()


def maybe_rebuild_puzzle(cfg: dict[str, str], previous: dict[str, str]) -> None:
    current = cfg["DEMO_MODE"]
    prev = previous.get("DEMO_MODE")
    if prev is not None and prev == current:
        return
    if prev is None:
        return

    mode = "demo" if current == "1" else "live Funda"
    print(f"DEMO_MODE changed ({prev} -> {current}), rebuilding {mode} puzzle...")
    rebuild_today_puzzle()


def main() -> None:
    cfg = parse_config(CONFIG)
    previous = parse_env_file(API_ENV)
    write_api_env(cfg)
    write_web_env(cfg)
    maybe_rebuild_puzzle(cfg, previous)

    print(f"Synced {CONFIG.name} ->")
    print(f"  {API_ENV.relative_to(ROOT)}")
    print(f"  {WEB_ENV.relative_to(ROOT)}")
    print(f"  DEMO_MODE={cfg['DEMO_MODE']}  DEBUG_FRESH={cfg['DEBUG_FRESH']}")


if __name__ == "__main__":
    main()
