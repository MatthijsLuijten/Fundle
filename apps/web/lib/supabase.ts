import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { amsterdamToday } from "./engine";

// Lazily construct the client so an unconfigured build/SSR pass never throws
// ("supabaseUrl is required"). In the browser the public env vars are present.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase niet geconfigureerd: zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  client = createClient(url, anonKey);
  return client;
}

export type PuzzleRow = {
  puzzle_date: string;
  puzzle_number: number;
  global_id: number;
  answer_token: string;
  payload: Record<string, unknown>;
};

export type StatsRow = {
  puzzle_date: string;
  plays: number;
  solves: number;
  guess_buckets: Record<string, number>;
};

async function fetchPuzzleRowByDate(date: string): Promise<PuzzleRow | null> {
  const { data, error } = await getClient()
    .from("daily_puzzles")
    .select("puzzle_date,puzzle_number,global_id,answer_token,payload")
    .eq("puzzle_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as PuzzleRow | null) ?? null;
}

export async function fetchTodayPuzzleRow(): Promise<PuzzleRow> {
  const row = await fetchPuzzleRowByDate(amsterdamToday());
  if (!row) throw new Error("No puzzle for today");
  return row;
}

export async function recordResult(date: string, won: boolean, guesses: number): Promise<void> {
  const { error } = await getClient().rpc("record_result", {
    p_date: date,
    p_won: won,
    p_guesses: guesses,
  });
  if (error) throw error;
}

export async function fetchStats(date: string): Promise<StatsRow | null> {
  const { data, error } = await getClient()
    .from("puzzle_stats")
    .select("puzzle_date,plays,solves,guess_buckets")
    .eq("puzzle_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as StatsRow | null) ?? null;
}

// All stats up to and including `date`, for ranking today's puzzle difficulty
// against past puzzles. One row per day, so this stays small for years.
export async function fetchStatsThrough(date: string): Promise<StatsRow[]> {
  const { data, error } = await getClient()
    .from("puzzle_stats")
    .select("puzzle_date,plays,solves,guess_buckets")
    .lte("puzzle_date", date);
  if (error) throw error;
  return (data as StatsRow[] | null) ?? [];
}
