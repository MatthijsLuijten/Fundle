-- Point both build triggers at the repo that actually holds the Actions
-- secrets.
--
-- 0001 and 0005 both POST workflow_dispatch to tristan-deep/Fundle, but that
-- repo has no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets: every build
-- there fails with "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set".
-- The production builds run in MatthijsLuijten/Fundle, which does have them.
--
-- For the daily build this only realigns the file with production: the
-- deployed trigger_daily_puzzle_build was already fixed by hand at some point
-- (its dispatches land in MatthijsLuijten/Fundle), so 0001 has been stale
-- ever since. trigger_city_puzzle_build was created verbatim by 0005 and was
-- never fixed, so city puzzles would never have been built by pg_cron.
--
-- Schedules are untouched; only the dispatch URL changes.

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
    url := 'https://api.github.com/repos/MatthijsLuijten/Fundle/actions/workflows/build-puzzle.yml/dispatches',
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
    url := 'https://api.github.com/repos/MatthijsLuijten/Fundle/actions/workflows/build-city-puzzles.yml/dispatches',
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
