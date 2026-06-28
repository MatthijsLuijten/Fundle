-- Fundle Supabase schema: daily puzzles + community stats.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) on a fresh project.

create table if not exists daily_puzzles (
  puzzle_date    date primary key,
  puzzle_number  int  not null,
  global_id      int  not null,
  answer_token   text not null,          -- obfuscated asking price (reversible)
  payload        jsonb not null,         -- hints + photo_urls, never the plain price
  created_at     timestamptz not null default now()
);

create table if not exists puzzle_stats (
  puzzle_date   date primary key references daily_puzzles(puzzle_date),
  plays         int   not null default 0,
  solves        int   not null default 0,
  guess_buckets jsonb not null default '{}'::jsonb  -- {"1":n,...,"5":n,"6":lost}
);

-- Row Level Security: anon may READ both tables, but never write directly.
alter table daily_puzzles enable row level security;
alter table puzzle_stats  enable row level security;

drop policy if exists read_puzzles on daily_puzzles;
create policy read_puzzles on daily_puzzles for select using (true);

drop policy if exists read_stats on puzzle_stats;
create policy read_stats on puzzle_stats for select using (true);

grant select on daily_puzzles to anon, authenticated;
grant select on puzzle_stats  to anon, authenticated;

-- Atomic, anon-callable stats increment. SECURITY DEFINER bypasses RLS so the
-- browser can record a result without direct write access to the table.
-- p_guesses: number of guesses for a win (1..5), or 6 to mean "lost".
create or replace function record_result(p_date date, p_won boolean, p_guesses int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

grant execute on function record_result(date, boolean, int) to anon, authenticated;
