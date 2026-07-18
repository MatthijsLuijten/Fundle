-- Trigger the "Build city puzzles" GitHub Actions workflow at Amsterdam midnight
-- via Supabase pg_cron + pg_net, mirroring 0001_daily_puzzle_cron.sql. Building
-- at midnight leaves all cities ready long before the 18:00 reveal.
--
-- Prerequisites (see supabase/README.md): same Vault secret as the daily cron
-- ('github_pat_build_puzzle', a GitHub token with "Actions: write" on the repo)
-- and .github/workflows/build-city-puzzles.yml on the default branch.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_city_puzzle_build()
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
    url := 'https://api.github.com/repos/tristan-deep/Fundle/actions/workflows/build-city-puzzles.yml/dispatches',
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

-- pg_cron runs in UTC. Amsterdam midnight = 22:00 UTC (CEST) / 23:00 UTC (CET);
-- fire just after both, the off-day one is a cheap idempotent no-op.
select cron.schedule(
  'city-puzzle-build-cest',
  '2 22 * * *',
  $$select public.trigger_city_puzzle_build()$$
);
select cron.schedule(
  'city-puzzle-build-cet',
  '2 23 * * *',
  $$select public.trigger_city_puzzle_build()$$
);
