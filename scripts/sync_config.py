#!/usr/bin/env python3
"""Sync fundle.config.env -> apps/api/.env and apps/web/.env.local."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "fundle.config.env"
API_ENV = ROOT / "apps" / "api" / ".env"
WEB_ENV = ROOT / "apps" / "web" / ".env.local"

REQUIRED = (
    "DEBUG_FRESH",
    "PRICE_BUCKETS",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
)


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

    # The puzzle builder (scripts/build_daily_puzzle.py) reads these locally.
    content = f"""# Generated from fundle.config.env - do not edit by hand
SUPABASE_URL={cfg["SUPABASE_URL"]}
SUPABASE_SERVICE_ROLE_KEY={cfg["SUPABASE_SERVICE_ROLE_KEY"]}
DEBUG_FRESH_SESSION={cfg["DEBUG_FRESH"]}
PRICE_BUCKETS={cfg["PRICE_BUCKETS"]}
"""
    API_ENV.write_text(content, encoding="utf-8")


def write_web_env(cfg: dict[str, str]) -> None:
    content = f"""# Generated from fundle.config.env - do not edit by hand
NEXT_PUBLIC_SUPABASE_URL={cfg["NEXT_PUBLIC_SUPABASE_URL"]}
NEXT_PUBLIC_SUPABASE_ANON_KEY={cfg["NEXT_PUBLIC_SUPABASE_ANON_KEY"]}
NEXT_PUBLIC_DEBUG_FRESH={cfg["DEBUG_FRESH"]}
NEXT_PUBLIC_CITY_LOCAL={cfg.get("CITY_LOCAL", "0")}
NEXT_PUBLIC_CITY_ENABLED={cfg.get("CITY_ENABLED", "0")}
"""
    WEB_ENV.write_text(content, encoding="utf-8")


def main() -> None:
    cfg = parse_config(CONFIG)
    write_api_env(cfg)
    write_web_env(cfg)

    print(f"Synced {CONFIG.name} ->")
    print(f"  {API_ENV.relative_to(ROOT)}")
    print(f"  {WEB_ENV.relative_to(ROOT)}")
    print(f"  DEBUG_FRESH={cfg['DEBUG_FRESH']}")


if __name__ == "__main__":
    main()
