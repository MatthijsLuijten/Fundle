# Fundle migration: Vercel+Render+Neon → $0 static + Supabase

This document is the cutover checklist for moving Fundle off the always-on
FastAPI/Render backend (the free-tier cold-start culprit) and Neon Postgres to a
**$0, zero-cold-start** setup:

- **GitHub Actions** builds the daily puzzle and writes it to **Supabase**.
- The **Next.js app on Vercel** is fully static; gameplay runs in the browser
  via a TypeScript port of the old backend logic (`apps/web/lib/engine.ts`).
- **Supabase** (free) stores the daily puzzle and community stats.
- **Render** and **Neon** are decommissioned.

## Architecture

```
GitHub Actions (cron 23:05 UTC ≈ 00:05–01:05 Amsterdam, + manual dispatch)
  → scripts/build_daily_puzzle.py  (pyfunda → obfuscated answer + payload)
  → UPSERT daily_puzzles in Supabase   (service_role key, idempotent)

Supabase (free Postgres + PostgREST)
  · daily_puzzles  — anon read; built only by the Action
  · puzzle_stats   — anon read; incremented via record_result() RPC

Next.js static on Vercel (no backend, no cold start)
  · fetch today's puzzle row (anon key)
  · local engine scores guesses / unlocks hints+photos → same PuzzleState as before
  · game state in localStorage; result + community stats via Supabase
```

The answer ships in the puzzle row but **obfuscated** (reversible, see
`apps/api/app/obfuscate.py` / `apps/web/lib/engine.ts`) — not encryption, just
enough that it isn't readable in the network tab. Acceptable for a casual game.

---

## Accounts & one-time setup

### 1. Supabase (new account if you don't have one) — free

> New to Supabase? It's a hosted Postgres database with an auto-generated REST
> API and a web dashboard. You won't touch a terminal here — everything is
> clicks + one paste of SQL.

#### 1.1 Create the project

1. Go to https://supabase.com → **Start your project** and sign in (GitHub login
   is easiest).
2. Click **New project**. Pick your org, give it a name (e.g. `fundle`), and
   **set a database password** (save it in a password manager — you won't need
   it for this migration, but Supabase requires one).
3. Choose a **Region** close to your players (e.g. *West EU (Ireland)* or
   *Central EU (Frankfurt)* for the Netherlands).
4. Click **Create new project** and wait ~2 minutes while it provisions. Free
   tier is ample here: 500 MB Postgres, no credit card.

#### 1.2 Run the schema — step by step

This creates the two tables, the read policies, and the stats function.
[`supabase/schema.sql`](supabase/schema.sql) is just a plain SQL file kept in the
repo as the source of truth for the database structure — you run it once by hand
in the dashboard (we're not using the Supabase CLI migration pipeline).

1. In the left sidebar of your project, click the **SQL Editor** icon
   (looks like `</>` / "SQL"). Open it.
2. Click **+ New query** (top of the editor) — you get an empty SQL tab.
3. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this repo,
   **select all** (Cmd/Ctrl+A), **copy**, and **paste** it into the empty query
   tab in Supabase.
4. Click **Run** (bottom-right of the editor, or press **Cmd/Ctrl + Enter**).
5. You should see **"Success. No rows returned"** at the bottom. That's correct —
   the script creates structure, it doesn't return data. (Re-running it later is
   safe: it uses `create table if not exists` and `create or replace`.)
6. Verify it worked: click the **Table Editor** icon in the sidebar — you should
   now see two tables, **`daily_puzzles`** and **`puzzle_stats`** (both empty for
   now; the build step in §"Cutover" fills them).

**What the script set up (plain English):**

- **`daily_puzzles`** — one row per day: the puzzle number, the listing payload
  (hints + photo URLs), and the obfuscated answer. Written only by the build job.
- **`puzzle_stats`** — one row per day of aggregate community numbers (plays,
  solves, guess distribution). Powers the "X% solved" panel.
- **RLS policies** — *Row Level Security*. By default a Supabase table with RLS
  enabled is **locked: nobody can read or write it through the public API**. A
  "policy" is a rule that re-opens specific access. Our script enables RLS on
  both tables and then adds two read-only policies (`using (true)` = "anyone may
  *select* every row"). It deliberately adds **no insert/update/delete policy**,
  so the public `anon` key in the browser can *read* puzzles and stats but can
  **never tamper** with them. The only way to write stats is the controlled
  function below.
- **`record_result()` RPC** — a small database function the browser calls to
  bump the stats counters. It runs as `security definer` (with the table owner's
  rights), so it can update `puzzle_stats` even though the browser itself has no
  write access. That's the one tightly-scoped write path. The daily puzzle is
  written separately by the build job using the secret `service_role` key, which
  bypasses RLS entirely.

> Tip: if you ever need to start clean, paste and run
> `drop table if exists puzzle_stats; drop table if exists daily_puzzles;` then
> re-run `supabase/schema.sql`.

#### 1.3 Copy your API keys

1. In the sidebar, open **Project Settings** (the gear icon) → **API**.
2. Copy these three values (you'll paste them into GitHub and Vercel below):
   - **Project URL** (e.g. `https://abcdxyz.supabase.co`) → used as **both**
     `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`.
   - **`anon` `public` key** (under "Project API keys") →
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Safe to expose in the browser — Row Level
     Security only allows reads + the `record_result` function.
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY`. **Keep this
     secret** — it bypasses RLS. It goes **only** into GitHub Actions secrets and
     your local `fundle.config.env`, never into the frontend.

> The daily Action writing a row keeps the project active, so the free-tier
> 7-day inactivity pause never triggers.

### 2. GitHub repository (existing) — Actions secrets & variables

In **Settings → Secrets and variables → Actions**:

- **Secrets**
  - `SUPABASE_URL` = your project URL
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
- **Variables**
  - `PRICE_BUCKETS` = `150000:400000:0.20;400000:600000:0.30;600000:900000:0.30;900000:1400000:0.15;1400000::0.05`
    (or your preferred distribution)

The [`build-puzzle`](.github/workflows/build-puzzle.yml) workflow runs daily and
can be triggered manually (`Run workflow`) with an optional `date` and `force`.

### 3. Vercel (existing project) — environment variables

In the Vercel project **Settings → Environment Variables** (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL` = your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key

Remove the old `NEXT_PUBLIC_API_URL`. Redeploy.

### 4. Local dev (optional)

Copy `fundle.config.env.example` → `fundle.config.env` and fill in the four
Supabase values + `PRICE_BUCKETS`. `npm run setup` / `npm run dev` syncs them to
`apps/api/.env` and `apps/web/.env.local`.

---

## Cutover steps

1. **Seed a puzzle.** Run the `build-puzzle` Action via *Run workflow* (or
   locally: `uv run --project apps/api python scripts/build_daily_puzzle.py`).
   Confirm a row appears in `daily_puzzles` with a non-plaintext `answer_token`.
2. **Deploy the frontend** to Vercel with the new env vars.
3. **Smoke test** the live site: puzzle loads, guesses score, hints/photos
   unlock, win/loss reveals the price + Funda link, community stats appear.
4. **Decommission** once verified:
   - Delete / suspend the **Render** API service (and any Render cron job).
   - Delete the **Neon** project.
   - (Optional) Remove the retained FastAPI server files
     (`apps/api/app/main.py`, `routes/`, `database.py`, `models.py`,
     `schemas.py`). They're kept only so `apps/api/tests/test_game.py` and the
     parity-fixture generator can run against the original logic; the production
     path doesn't use them.

## Rollback

The old FastAPI server code is still present until you delete it in step 4. To
roll back before deleting, repoint `NEXT_PUBLIC_API_URL` and revert
`apps/web/lib/api.ts` (git). After decommissioning Render/Neon, rollback means
redeploying those services.

## What changed in the repo

- **Added:** `supabase/schema.sql`, `.github/workflows/build-puzzle.yml`,
  `apps/api/app/obfuscate.py`, `apps/web/lib/{engine,supabase,gameStore}.ts`,
  `apps/web/components/CommunityStats.tsx`, parity fixtures + tests.
- **Changed:** `scripts/build_daily_puzzle.py` (publishes to Supabase),
  `apps/web/lib/api.ts` (local engine), `Game.tsx`, `ResultCard.tsx`,
  `scripts/{sync_config.py,dev.js}`, env examples, CI.
- **Unchanged:** the gameplay UX and the `PuzzleState` contract the UI consumes.
