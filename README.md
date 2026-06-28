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
client-side. See [MIGRATION_README.md](MIGRATION_README.md) for the architecture
and the accounts/secrets needed.

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

**Debug:** set `DEBUG_FRESH=1` in `fundle.config.env` to start a fresh game on every page refresh. Use `0` for normal daily persistence (state in localStorage).

### Daily puzzle

Puzzle day boundaries use **Europe/Amsterdam** (midnight NL time), not UTC. The
puzzle is published to Supabase, not a local DB.

Build/refresh today's puzzle from Funda (from the project root, with Supabase env set):

```bash
uv run --project apps/api python scripts/build_daily_puzzle.py          # today
uv run --project apps/api python scripts/build_daily_puzzle.py --force   # rebuild
```

**Production:** the [`build-puzzle`](.github/workflows/build-puzzle.yml) GitHub
Action runs daily at `23:00 UTC` (Amsterdam midnight in winter) and upserts the
puzzle into Supabase. Trigger it manually from the Actions tab (`workflow_dispatch`)
to seed/backfill. No server, no cron host needed.

## Project layout

```
apps/api/     pyfunda scraping + puzzle builder (+ retained game.py for parity fixtures)
apps/web/     Next.js UI + client-side game engine (lib/engine.ts)
scripts/      build_daily_puzzle.py (Supabase publish), gen_parity_fixtures.py
supabase/     schema.sql (tables, RLS, stats RPC) — run once in the dashboard
```

## Testing

```bash
cd apps/api && uv run pytest && uv run ruff check app tests   # builder + obfuscation + game logic
cd apps/web && npm test                                       # TS engine + cross-language parity
```

If you change game logic on either side, regenerate parity fixtures:

```bash
uv run --project apps/api python scripts/gen_parity_fixtures.py
```

## License note

pyfunda is AGPL-3.0. Funda data is unofficial; use responsibly.
