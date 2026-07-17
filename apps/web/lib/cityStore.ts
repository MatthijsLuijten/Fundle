// The player's own bid per (city, date), in localStorage. The authoritative
// bid lives server-side (city_bids); this is just a local echo so the UI can
// show "you've bid" without a round-trip, and so the offline mock has a store.

const PREFIX = "fundle_city_";

export type CityBidState = { bid: number; submittedAt: string };

function key(city: string, date: string): string {
  return `${PREFIX}${city}_${date}`;
}

export function loadCityBid(city: string, date: string): CityBidState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(city, date));
    return raw ? (JSON.parse(raw) as CityBidState) : null;
  } catch {
    return null;
  }
}

export function saveCityBid(city: string, date: string, bid: number): void {
  if (typeof window === "undefined") return;
  const state: CityBidState = { bid, submittedAt: new Date().toISOString() };
  localStorage.setItem(key(city, date), JSON.stringify(state));
}
