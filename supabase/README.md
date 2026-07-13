# Supabase setup

## Schema

[`schema.sql`](./schema.sql) is the full database schema (tables, RLS, the
`record_result` function). Run it once in the **Supabase SQL editor** on a fresh
project.

## Migrations

[`migrations/`](./migrations) holds incremental changes applied on top of the
schema. Run each file's contents in the SQL editor (or via the Supabase CLI) in
order.

### `0001_daily_puzzle_cron.sql` — daily puzzle trigger

Fires the **Build daily puzzle** GitHub Actions workflow using `pg_cron` +
`pg_net`, instead of relying on GitHub's own cron (which is best-effort, often
15+ minutes late, and auto-disabled after 60 days of repo inactivity). The
schedule times set here are superseded by `0003`. One-time setup:

1. **Create a GitHub token** that can start the workflow.
   - GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate.
   - Repository access: only `tristan-deep/Fundle`.
   - Permissions: **Actions → Read and write**.
   - Copy the token (starts with `github_pat_…`).
   - _(A classic token with the `workflow` scope works too.)_

2. **Store the token in Supabase Vault.** In the SQL editor:
   ```sql
   select vault.create_secret('github_pat_xxx', 'github_pat_build_puzzle');
   ```
   (Or: Dashboard → Project Settings → Vault → New secret, name
   `github_pat_build_puzzle`.)

3. **Apply the migration** — paste the contents of
   `migrations/0001_daily_puzzle_cron.sql` into the SQL editor and run it. This
   enables the extensions, creates `trigger_daily_puzzle_build()`, and schedules
   two cron jobs (22:01 UTC for CEST, 23:01 UTC for CET — Amsterdam midnight in
   both seasons).

4. **Verify.**
   ```sql
   -- scheduled jobs exist
   select jobname, schedule, active from cron.job;

   -- fire it manually once and watch for a workflow run on GitHub
   select public.trigger_daily_puzzle_build();

   -- inspect recent cron runs / HTTP responses
   select * from cron.job_run_details order by start_time desc limit 5;
   select * from net._http_response order by created desc limit 5;
   ```
   A `201` from the GitHub API means the dispatch was accepted.

### `0002_abuse_protection.sql` — hardened stats recording

Response to the 2026-07-06 spam incident (~1000 scripted fake results).
Replaces `record_result` with a self-defending version and adds a
`result_submissions` audit table (one row per accepted result: timestamp,
per-day hashed IP, browser session id). Protections, all server-side and
invisible to real players:

- max **10 counted results per IP per puzzle day** (excess silently ignored, so
  bots get no feedback);
- **one result per browser session per day**;
- only **today's** (Europe/Amsterdam) puzzle date is accepted — no backfilling
  past days;
- guess-count/won-lost sanity checks.

Apply by pasting the file into the SQL editor. No config needed. To inspect or
clean up after an attack:

```sql
-- who submitted what today
select ip_hash, count(*), min(created_at), max(created_at)
from result_submissions
where puzzle_date = current_date
group by ip_hash order by count(*) desc;

-- after deleting bad rows, rebuild the day's aggregates from the audit log:
update puzzle_stats s set
  plays  = agg.plays, solves = agg.solves, guess_buckets = agg.buckets
from (
  select puzzle_date, count(*) plays,
         count(*) filter (where won) solves,
         jsonb_object_agg(guesses::text, n) buckets
  from (select puzzle_date, won, guesses, count(*) n
        from result_submissions where puzzle_date = 'YYYY-MM-DD'
        group by 1,2,3) t
  group by puzzle_date
) agg
where s.puzzle_date = agg.puzzle_date;
```

### `0003_evening_prebuild_cron.sql` — evening pre-build

Reliability rework of the `0001` schedule. The build script now pre-builds
**tomorrow's** puzzle (and backfills today's if missing), so the new puzzle is
already in `daily_puzzles` when the Amsterdam date flips — release at exactly
00:00 is just the app querying by `puzzle_date`; nothing has to succeed at
midnight anymore. This migration therefore:

- unschedules the midnight pair (`daily-puzzle-build-cest`/`-cet`);
- schedules `daily-puzzle-prebuild` at 19:01 UTC (Amsterdam evening in both
  CET and CEST — exact time no longer matters);
- schedules `daily-puzzle-prebuild-retry` at 21:31 UTC, a no-op when the first
  run succeeded, a fresh build if it didn't.

Combined with in-process retries in the build script (Funda's search API fails
transiently), a puzzle can only be missing at midnight if Funda is down across
both evening windows *and* all retries — and even then the GitHub morning cron
backfills it.

Apply by pasting the file into the SQL editor. Verify with the same queries as
`0001` (job names are now `daily-puzzle-prebuild*`).

### Notes

- If you fork to a different repo, update the `url` in
  `trigger_daily_puzzle_build()` and the `ref` (default branch) if it isn't
  `main`.
- The GitHub Actions workflow keeps a single daily **safety-net** cron
  (`5 6 * * *`) in case this trigger path ever breaks (e.g. expired PAT); the
  build script is idempotent, so it's a no-op on normal days.
- The fine-grained GitHub PAT in Vault **expires** (max 1 year). When the
  dispatches start failing (`401` in `net._http_response`), generate a new
  token and update the `github_pat_build_puzzle` Vault secret.
- To change times: `select cron.unschedule('daily-puzzle-prebuild');` then
  re-run the relevant `cron.schedule(...)`.
