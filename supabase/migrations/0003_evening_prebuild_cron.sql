-- Move the daily puzzle trigger from Amsterdam midnight to the evening
-- before. The build script now pre-builds *tomorrow's* puzzle (and backfills
-- today's if missing), so the new puzzle is already sitting in daily_puzzles
-- when the date flips — nothing has to succeed at 00:00 anymore, and the app
-- releases it exactly at midnight by querying on puzzle_date.
--
-- Because the exact firing time no longer matters (any Amsterdam-evening time
-- works in both CET and CEST), the old midnight DST pair is replaced by:
--   * one primary evening run, and
--   * one retry slot 2.5h later that no-ops when the first run succeeded
--     (the build script and workflow are idempotent).
-- The GitHub Actions morning cron (build-puzzle.yml) stays as an independent
-- last-resort net in case this trigger path breaks (e.g. expired PAT).

select cron.unschedule(jobname)
from cron.job
where jobname in ('daily-puzzle-build-cest', 'daily-puzzle-build-cet');

select cron.schedule(
  'daily-puzzle-prebuild',
  '1 19 * * *',   -- 21:01 Amsterdam (CEST) / 20:01 (CET)
  $$select public.trigger_daily_puzzle_build()$$
);

select cron.schedule(
  'daily-puzzle-prebuild-retry',
  '31 21 * * *',  -- 23:31 Amsterdam (CEST) / 22:31 (CET)
  $$select public.trigger_daily_puzzle_build()$$
);
