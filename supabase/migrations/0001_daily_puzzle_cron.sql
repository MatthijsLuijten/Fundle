-- Trigger the "Build daily puzzle" GitHub Actions workflow at Amsterdam
-- midnight via Supabase pg_cron + pg_net. This replaces relying on GitHub's
-- own cron (best-effort, often 15+ min late) with a precise external trigger.
--
-- Prerequisites (see supabase/README.md):
--   1. A GitHub token with "Actions: write" on the repo, stored in Vault as
--      secret name 'github_pat_build_puzzle'.
--   2. The repo's default branch contains .github/workflows/build-puzzle.yml.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- POSTs a workflow_dispatch to GitHub. The build script computes "today" in
-- Europe/Amsterdam and is idempotent, so calling this is always safe.
create or replace function public.trigger_daily_puzzle_build()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  gh_token text;
begin
  select decrypted_secret into gh_token
  from vault.decrypted_secrets
  where name = 'github_pat_build_puzzle';

  if gh_token is null then
    raise exception 'Vault secret github_pat_build_puzzle not found';
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/tristan-deep/Fundle/actions/workflows/build-puzzle.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || gh_token,
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'fundle-supabase-cron',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main')
  );
end;
$$;

-- pg_cron runs in UTC. Amsterdam midnight = 22:00 UTC (summer, CEST) and
-- 23:00 UTC (winter, CET). We fire just after both; whichever one lands on the
-- new Amsterdam day builds the puzzle, and the other is a cheap idempotent
-- no-op. ':01' avoids the exact top of the minute.
select cron.schedule(
  'daily-puzzle-build-cest',
  '1 22 * * *',
  $$select public.trigger_daily_puzzle_build()$$
);
select cron.schedule(
  'daily-puzzle-build-cet',
  '1 23 * * *',
  $$select public.trigger_daily_puzzle_build()$$
);
