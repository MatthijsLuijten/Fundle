// Supabase data access for city mode. The puzzle payload is read directly
// (answer_token is deliberately not selectable by anon — see 0003_city_mode.sql);
// bids and the reveal go through the locked-down RPCs.

import { CITY_BY_KEY, type CityPuzzleView, type CityReveal } from "./cityData";
import { amsterdamToday, fullHints, fundaListingUrl } from "./engine";
import { getClient } from "./supabase";

type CityPuzzleRow = {
  city: string;
  puzzle_date: string;
  puzzle_number: number;
  global_id: number;
  closes_at: string;
  payload: Record<string, unknown>;
};

function toView(row: CityPuzzleRow): CityPuzzleView {
  const payload = row.payload;
  const photos = ((payload.photo_urls as string[] | undefined) ?? []).filter(Boolean);
  return {
    city: row.city,
    cityDisplay: (payload.city as string) ?? CITY_BY_KEY[row.city]?.display ?? row.city,
    puzzle_number: row.puzzle_number,
    closes_at: row.closes_at,
    photos,
    hints: fullHints(payload),
    url: fundaListingUrl(payload),
  };
}

// City mode plays one city per day and the builder decides which, so the client
// asks by date and learns the city from the row. Days built before that change
// hold ten rows; ordering by city keeps those legacy days on one stable pick
// instead of failing the query.
export async function fetchTodayCityPuzzle(): Promise<CityPuzzleView | null> {
  const { data, error } = await getClient()
    .from("city_puzzles")
    // Explicit columns: a `select *` would fail (answer_token is not granted).
    .select("city,puzzle_date,puzzle_number,global_id,closes_at,payload")
    .eq("puzzle_date", amsterdamToday())
    .order("city")
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? toView(row as CityPuzzleRow) : null;
}

export async function submitCityBid(
  city: string,
  amount: number,
  sessionId: string
): Promise<number> {
  const { data, error } = await getClient().rpc("submit_city_bid", {
    p_city: city,
    p_date: amsterdamToday(),
    p_bid: amount,
    p_session_id: sessionId,
  });
  if (error) throw error;
  return (data as { your_bid: number }).your_bid;
}

export async function revealCity(city: string, sessionId: string): Promise<CityReveal | null> {
  const { data, error } = await getClient().rpc("reveal_city", {
    p_city: city,
    p_date: amsterdamToday(),
    p_session_id: sessionId,
  });
  if (error) throw error;
  return (data as CityReveal | null) ?? null;
}
