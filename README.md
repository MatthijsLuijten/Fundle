<p align="center">
  <img src="apps/web/public/logo.png" alt="Fundle" width="360">
</p>

<p align="center">
  <strong>Guess the Funda asking price in 5 tries.</strong><br>
  Each wrong guess unlocks more hints — area, energy label, photos, and more.
</p>

---

## Stack

- **Frontend:** Next.js, static on Vercel (`apps/web`) — gameplay runs entirely in the browser
- **Puzzle builder:** Python + pyfunda (`apps/api` + `scripts/`), run daily by GitHub Actions
- **Data:** Supabase (daily puzzle + community stats)

There is no always-on backend — the daily puzzle is pre-built into Supabase and the
game engine (guess scoring, hints, photo reveals) is a TypeScript port that runs
client-side.

## Daily use

From the **project root**:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires `NEXT_PUBLIC_SUPABASE_*`
in `fundle.config.env` and at least one puzzle row in Supabase (see below).

## First-time setup

Run once from the project root:

```bash
npm run setup
```

That creates the API venv, installs Python and npm dependencies, copies `fundle.config.env.example` → `fundle.config.env` (if needed), and syncs env files. Then use `npm run dev` for daily development.

Local settings live in `fundle.config.env` (gitignored). Copy from `fundle.config.env.example` and fill in your Supabase keys.

**Debug:** set `DEBUG_FRESH=1` in `fundle.config.env` to start a fresh game on every page refresh with a **live random Funda listing** (no Supabase). Use `0` for normal daily persistence (state in localStorage).

From the CLI you can also fetch one random listing without touching the database:

```bash
uv run --project apps/api python scripts/build_daily_puzzle.py --random
```

### Daily puzzle

Puzzle day boundaries use **Europe/Amsterdam** (midnight NL time), not UTC. The
puzzle is published to Supabase, not a local DB.

Build/refresh today's puzzle from Funda (from the project root, with Supabase env set):

```bash
uv run --project apps/api python scripts/build_daily_puzzle.py          # today
uv run --project apps/api python scripts/build_daily_puzzle.py --force   # rebuild
```

**Production:** the [`build-puzzle`](.github/workflows/build-puzzle.yml) GitHub
Action runs daily at Amsterdam midnight (22:00/23:00 UTC depending on DST) and upserts the
puzzle into Supabase. Trigger it manually from the Actions tab (`workflow_dispatch`)
to seed/backfill. No server, no cron host needed.

## Project layout

```
apps/api/     pyfunda + daily puzzle builder (no server; runs in CI)
apps/web/     Next.js UI + client-side game engine (lib/engine.ts)
scripts/      build_daily_puzzle.py (Supabase publish)
supabase/     schema.sql (tables, RLS, stats RPC) — run once in the dashboard
```

## Testing

```bash
cd apps/api && uv run pytest && uv run ruff check app tests   # builder + obfuscation + price buckets
cd apps/web && npm test                                       # TS engine + golden fixtures
```

Gameplay logic lives only in `apps/web/lib/engine.ts`. Its output is pinned by the
golden fixtures in `apps/web/lib/__fixtures__/parity.json`; if you deliberately
change engine behavior, update that file by hand and review the diff.

## License note

pyfunda is AGPL-3.0. Funda data is unofficial; use responsibly.
