-- City mode: sealed-bid, delayed-reveal game against other players.
--
-- Unlike the daily puzzle, the answer must stay hidden until the reveal, so:
--   * anon can read every city_puzzles column EXCEPT answer_token (column grants),
--   * bids are stored server-side in city_bids (no anon access at all),
--   * two SECURITY DEFINER RPCs (submit_city_bid / reveal_city) are the only
--     way to write a bid or learn the price + your result.
--
-- One shared listing per (city, puzzle_date). Bidding opens at 00:00 and closes
-- at closes_at (built as 18:00 Europe/Amsterdam by scripts/build_city_puzzles.py).
-- Winner = the single closest bid; ties broken by earliest bid ("first bid wins").

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- One authored listing per city per day. answer_token is the reversible-
-- obfuscated asking price (same scheme as daily_puzzles), deliberately NOT
-- granted to anon so the price can't be read before closes_at.
create table if not exists city_puzzles (
  city          text        not null,   -- stable slug key, e.g. 'den-haag'
  puzzle_date   date        not null,
  puzzle_number int         not null,
  global_id     int         not null,
  answer_token  text        not null,   -- obfuscated price; withheld from anon
  closes_at     timestamptz not null,   -- reveal time (18:00 Europe/Amsterdam)
  payload       jsonb       not null,   -- hints + photo_urls, never the price
  created_at    timestamptz not null default now(),
  primary key (city, puzzle_date)
);

-- Every bid placed, one row per (city, day, session). Never readable by anon;
-- only the RPCs below touch it. ip_hash is a coarse anti-flood signal.
create table if not exists city_bids (
  id           uuid        primary key default gen_random_uuid(),
  city         text        not null,
  puzzle_date  date        not null,
  session_id   text        not null,
  bid_eur      int         not null,
  ip_hash      text,
  created_at   timestamptz not null default now(),
  unique (city, puzzle_date, session_id),
  foreign key (city, puzzle_date) references city_puzzles (city, puzzle_date)
);
create index if not exists city_bids_lookup on city_bids (city, puzzle_date);

-- RLS. city_puzzles: anon may read the non-answer columns (column grants below).
-- city_bids: no anon policy at all -> no direct read/write, RPC-only.
alter table city_puzzles enable row level security;
alter table city_bids    enable row level security;

drop policy if exists read_city_puzzles on city_puzzles;
create policy read_city_puzzles on city_puzzles for select using (true);

-- Column-level grants: everything EXCEPT answer_token. A `select *` by anon will
-- fail; the frontend selects explicit columns (see apps/web/lib/citySupabase.ts).
grant select (city, puzzle_date, puzzle_number, global_id, closes_at, payload, created_at)
  on city_puzzles to anon, authenticated;
-- (No grants on city_bids: only the SECURITY DEFINER functions read/write it.)

-- Reverse of app/obfuscate.py::obfuscate (base64 of answer*OBF_K + OBF_S).
create or replace function city_deobfuscate(p_token text)
returns int
language sql
immutable
as $$
  select round(
    (convert_from(decode(p_token, 'base64'), 'UTF8')::bigint - 104729) / 7919.0
  )::int;
$$;

-- Place a single sealed bid. First bid per session wins: a second call for the
-- same (city, day, session) is a silent no-op that keeps the original bid.
-- Rejects bids after closes_at, for the wrong day, or out of a sane range.
create or replace function submit_city_bid(
  p_city text,
  p_date date,
  p_bid  int,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closes_at timestamptz;
  v_ip        text;
  v_ip_hash   text;
  v_ip_count  int;
  v_stored    int;
begin
  select closes_at into v_closes_at
  from city_puzzles
  where city = p_city and puzzle_date = p_date;

  if v_closes_at is null then
    raise exception 'no city puzzle for % on %', p_city, p_date;
  end if;
  if (now() at time zone 'Europe/Amsterdam')::date <> p_date then
    raise exception 'city puzzle % is not today''s puzzle', p_date;
  end if;
  if now() >= v_closes_at then
    raise exception 'bidding for % is closed', p_city;
  end if;
  if p_bid < 10000 or p_bid > 100000000 then
    raise exception 'bid out of range';
  end if;

  -- Coarse per-IP daily flood cap. Legit users can bid on every city, so the
  -- cap is generous; over it we silently accept without storing (mirrors the
  -- daily record_result hardening: give a flood no signal to adapt to).
  v_ip := split_part(
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
    ',', 1
  );
  if v_ip <> '' then
    v_ip_hash := md5(v_ip || ':' || p_date::text);
    select count(*) into v_ip_count
    from city_bids
    where puzzle_date = p_date and ip_hash = v_ip_hash;
    if v_ip_count >= 40 then
      return jsonb_build_object('accepted', true, 'your_bid', p_bid);
    end if;
  end if;

  insert into city_bids (city, puzzle_date, session_id, bid_eur, ip_hash)
  values (p_city, p_date, p_session_id, p_bid, v_ip_hash)
  on conflict (city, puzzle_date, session_id) do nothing
  returning bid_eur into v_stored;

  if v_stored is null then
    -- Existing bid for this session: first bid wins, keep it.
    select bid_eur into v_stored
    from city_bids
    where city = p_city and puzzle_date = p_date and session_id = p_session_id;
  end if;

  return jsonb_build_object('accepted', true, 'your_bid', v_stored);
end;
$$;

-- Reveal for a session. Before closes_at: returns {open:true} plus this session's
-- own bid (no price). After closes_at: returns the price and this session's
-- outcome — distance, rank, whether they placed the (tie-broken-earliest)
-- winning bid, and the field size. Winner identity is never exposed (no accounts).
create or replace function reveal_city(
  p_city text,
  p_date date,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closes_at timestamptz;
  v_token     text;
  v_answer    int;
  v_your_bid  int;
  v_your_dist int;
  v_your_rank int;
  v_win_dist  int;
  v_total     int;
  v_won       boolean;
begin
  select closes_at, answer_token into v_closes_at, v_token
  from city_puzzles
  where city = p_city and puzzle_date = p_date;

  if v_closes_at is null then
    return null;  -- no such puzzle
  end if;

  select bid_eur into v_your_bid
  from city_bids
  where city = p_city and puzzle_date = p_date and session_id = p_session_id;

  if now() < v_closes_at then
    return jsonb_build_object(
      'open', true,
      'closes_at', v_closes_at,
      'your_bid', v_your_bid
    );
  end if;

  v_answer := city_deobfuscate(v_token);

  with bids as (
    select session_id, bid_eur, created_at, id,
           abs(bid_eur - v_answer) as dist
    from city_bids
    where city = p_city and puzzle_date = p_date
  ),
  ranked as (
    select *,
      row_number() over (order by dist asc, created_at asc, id asc) as overall_rank,
      min(dist) over () as best_dist,
      count(*) over () as total
    from bids
  )
  select overall_rank, dist, best_dist, total, (overall_rank = 1)
    into v_your_rank, v_your_dist, v_win_dist, v_total, v_won
  from ranked
  where session_id = p_session_id;

  if v_total is null then
    -- Session didn't bid; still return the price + winning distance + field size.
    select min(abs(bid_eur - v_answer)), count(*)
      into v_win_dist, v_total
    from city_bids
    where city = p_city and puzzle_date = p_date;
    v_won := false;
  end if;

  return jsonb_build_object(
    'open', false,
    'closes_at', v_closes_at,
    'answer_eur', v_answer,
    'your_bid', v_your_bid,
    'your_distance', v_your_dist,
    'your_rank', v_your_rank,
    'winning_distance', v_win_dist,
    'total_bids', coalesce(v_total, 0),
    'won', coalesce(v_won, false)
  );
end;
$$;

grant execute on function submit_city_bid(text, date, int, text) to anon, authenticated;
grant execute on function reveal_city(text, date, text)          to anon, authenticated;
grant execute on function city_deobfuscate(text)                 to anon, authenticated;
