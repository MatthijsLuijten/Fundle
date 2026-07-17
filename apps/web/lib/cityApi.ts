// City-mode API facade. Swaps between the real Supabase backend and the offline
// mock (NEXT_PUBLIC_CITY_LOCAL=1) so the whole flow is playable without a live
// Funda/Supabase — the UI calls these three functions either way.

import type { CityPuzzleView, CityReveal } from "./cityData";
import * as mock from "./cityMock";
import * as remote from "./citySupabase";
import { saveCityBid } from "./cityStore";
import { amsterdamToday } from "./engine";
import { getOrCreateSessionId } from "./storage";

export function isCityLocal(): boolean {
  return process.env.NEXT_PUBLIC_CITY_LOCAL === "1";
}

export function fetchCityPuzzle(city: string): Promise<CityPuzzleView | null> {
  return isCityLocal() ? mock.fetchCityPuzzle(city) : remote.fetchCityPuzzle(city);
}

export async function submitCityBid(city: string, amount: number): Promise<number> {
  if (isCityLocal()) return mock.submitCityBid(city, amount);
  const stored = await remote.submitCityBid(city, amount, getOrCreateSessionId());
  // Echo the authoritative (first-wins) bid locally so the UI is instant.
  saveCityBid(city, amsterdamToday(), stored);
  return stored;
}

export function revealCity(city: string): Promise<CityReveal | null> {
  return isCityLocal() ? mock.revealCity(city) : remote.revealCity(city, getOrCreateSessionId());
}
