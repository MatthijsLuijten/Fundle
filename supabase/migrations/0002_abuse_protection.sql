-- Harden community-stats recording against scripted spam.
--
-- Approach: keep the anon-callable record_result RPC, but make it defend
-- itself server-side. No CAPTCHA, no extra services, no UX change.
--   1. Audit table: every accepted submission becomes a row (timestamp,
--      hashed IP, session id), so a future incident can be filtered and
--      cleaned precisely instead of guessing at aggregate counters.
--   2. Per-IP daily cap: at most 10 counted results per IP per puzzle day
--      (generous for households/offices behind one NAT). Floods are silently
--      ignored — the bot gets a success response and no signal to adapt to.
--   3. Per-session dedup: one counted result per browser session per day.
--   4. Sanity checks: plausible guess counts, won/lost consistency, and only
--      today's (Europe/Amsterdam) puzzle can be recorded — no backfilling
--      junk into past days.

-- 1. Per-submission audit log. Not readable/writable by anon (RLS on, no
--    policies); only the SECURITY DEFINER function and service role touch it.
create table if not exists result_submissions (
  id          bigint generated always as identity primary key,
  puzzle_date date not null,
  session_id  text,
  ip_hash     text,             -- md5(ip + date): per-day identifier, not a global tracker
  won         boolean not null,
  guesses     int not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists result_submissions_session_uniq
  on result_submissions (puzzle_date, session_id)
  where session_id is not null;

create index if not exists result_submissions_ip_idx
  on result_submissions (puzzle_date, ip_hash);

alter table result_submissions enable row level security;
revoke all on result_submissions from anon, authenticated;

-- 2. Replace record_result. Drop the old 3-arg signature first so PostgREST
--    doesn't see two overloads; the new function's default keeps old cached
--    clients (which don't send p_session_id) working.
drop function if exists record_result(date, boolean, int);

create or replace function record_result(
  p_date date,
  p_won boolean,
  p_guesses int,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session text;
  v_ip      text;
  v_ip_hash text;
begin
  -- Sanity: bucket 1..5 = won in N guesses, 6 = lost.
  if p_guesses is null or p_guesses < 1 or p_guesses > 6 then return; end if;
  if p_won and p_guesses = 6 then return; end if;
  if not p_won and p_guesses <> 6 then return; end if;

  -- Only today's puzzle (Amsterdam day boundary, same as the frontend).
  if p_date is distinct from (now() at time zone 'Europe/Amsterdam')::date then
    return;
  end if;

  -- Session ids are client-chosen; treat oversized ones as absent.
  v_session := nullif(trim(p_session_id), '');
  if length(v_session) > 64 then v_session := null; end if;

  -- Caller IP from the PostgREST request headers, hashed with the date so the
  -- stored value can't be used to track an IP across days.
  v_ip := split_part(
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
    ',', 1);
  v_ip_hash := case when v_ip = '' then null else md5(v_ip || ':' || p_date::text) end;

  -- Per-IP daily cap: silently drop the excess.
  if v_ip_hash is not null then
    if (select count(*) from result_submissions
        where puzzle_date = p_date and ip_hash = v_ip_hash) >= 10 then
      return;
    end if;
  end if;

  -- Per-session dedup: a repeat submission from the same browser is a no-op.
  insert into result_submissions (puzzle_date, session_id, ip_hash, won, guesses)
  values (p_date, v_session, v_ip_hash, p_won, p_guesses)
  on conflict (puzzle_date, session_id) where session_id is not null do nothing;
  if not found then return; end if;

  insert into puzzle_stats (puzzle_date, plays, solves, guess_buckets)
  values (
    p_date,
    1,
    case when p_won then 1 else 0 end,
    jsonb_build_object(p_guesses::text, 1)
  )
  on conflict (puzzle_date) do update set
    plays  = puzzle_stats.plays + 1,
    solves = puzzle_stats.solves + (case when p_won then 1 else 0 end),
    guess_buckets = puzzle_stats.guess_buckets ||
      jsonb_build_object(
        p_guesses::text,
        coalesce((puzzle_stats.guess_buckets ->> p_guesses::text)::int, 0) + 1
      );
end;
$$;

grant execute on function record_result(date, boolean, int, text) to anon, authenticated;
