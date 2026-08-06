// Offline city-mode backend (NEXT_PUBLIC_CITY_LOCAL=1). Serves fixture listings,
// stores the player's bid in localStorage, and fabricates deterministic opponent
// bids so ranking/reveal can be exercised with no Funda and no Supabase.
//
// Reveal fast-forward for testing: append ?reveal=1 to the URL (or it flips
// automatically once it's past 18:00 Amsterdam) to jump straight to the result.

import { CITY_BY_KEY, type CityPuzzleView, type CityReveal } from "./cityData";
import { computeOutcome } from "./cityEngine";
import { amsterdamToday, fullHints } from "./engine";
import { loadCityBid, saveCityBid } from "./cityStore";
import fixtures from "./__fixtures__/cityPuzzles.json";

type Fixture = { answer_eur: number; payload: Record<string, unknown> };
const CITY_FIXTURES = (fixtures as { cities: Record<string, Fixture> }).cities;

function amsterdamHourNow(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
    10
  );
}

function closesAtISO(dateStr: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(`${dateStr}T18:00:00Z`));
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const h = Number(off.match(/GMT([+-]?\d+)/)?.[1] ?? 2);
  const sign = h >= 0 ? "+" : "-";
  return `${dateStr}T18:00:00${sign}${String(Math.abs(h)).padStart(2, "0")}:00`;
}

// Dev reveal fast-forward via the URL, so you never wait until 18:00:
//   ?reveal=1     reveal now, real outcome from your own bid
//   ?reveal=win   reveal now, force a winning result (no bid needed)
//   ?reveal=lose  reveal now, force a losing result (no bid needed)
function revealParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("reveal");
}

// Deterministic PRNG so a city's opponent field is stable across reloads.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Opponents kept at least 1.5% off the answer, so a sharp bid can actually win.
function opponentBids(city: string, answer: number): number[] {
  const rng = mulberry32(hashSeed(city));
  const count = 12 + Math.floor(rng() * 28);
  const bids: number[] = [];
  for (let i = 0; i < count; i++) {
    let spread = (rng() * 2 - 1) * 0.18;
    if (Math.abs(spread) < 0.015) spread = spread < 0 ? -0.015 : 0.015;
    bids.push(Math.round((answer * (1 + spread)) / 1000) * 1000);
  }
  return bids;
}

function fixtureFor(city: string): Fixture | null {
  return CITY_FIXTURES[city] ?? null;
}

export async function fetchCityPuzzle(city: string): Promise<CityPuzzleView | null> {
  const fx = fixtureFor(city);
  if (!fx) return null;
  const date = amsterdamToday();
  const photos = ((fx.payload.photo_urls as string[] | undefined) ?? []).filter(Boolean);
  return {
    city,
    cityDisplay: (fx.payload.city as string) ?? CITY_BY_KEY[city]?.display ?? city,
    puzzle_number: 1,
    closes_at: closesAtISO(date),
    photos,
    hints: fullHints(fx.payload),
    url: (fx.payload.url as string) ?? null,
  };
}

export async function submitCityBid(city: string, amount: number): Promise<number> {
  const date = amsterdamToday();
  const existing = loadCityBid(city, date);
  if (existing) return existing.bid; // first bid wins
  saveCityBid(city, date, amount);
  return amount;
}

export async function revealCity(city: string): Promise<CityReveal | null> {
  const fx = fixtureFor(city);
  if (!fx) return null;
  const date = amsterdamToday();
  const closes = closesAtISO(date);
  const mine = loadCityBid(city, date);
  const param = revealParam();
  const isClosed = param != null || amsterdamHourNow() >= 18;

  if (!isClosed) {
    return { open: true, closes_at: closes, your_bid: mine?.bid ?? null };
  }

  const answer = fx.answer_eur;
  const opponents = opponentBids(city, answer);

  // ?reveal=win / ?reveal=lose synthesize a bid so either result screen can be
  // seen without bidding (or knowing the price). Otherwise use the real bid.
  let yourBid = mine?.bid ?? null;
  if (param === "win") {
    yourBid = answer; // exact; opponents are kept >=1.5% off, so this wins
  } else if (param === "lose") {
    const maxOppDist = Math.max(...opponents.map((b) => Math.abs(b - answer)));
    yourBid = answer + maxOppDist + 1000; // worse than every opponent
  }

  if (yourBid == null) {
    const winning = Math.min(...opponents);
    return {
      open: false,
      closes_at: closes,
      your_bid: null,
      answer_eur: answer,
      your_distance: null,
      your_rank: null,
      winning_distance: winning,
      total_bids: opponents.length,
      won: false,
    };
  }

  const outcome = computeOutcome(answer, yourBid, opponents);
  return { open: false, closes_at: closes, your_bid: yourBid, answer_eur: answer, ...outcome };
}
