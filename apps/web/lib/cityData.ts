// City-mode registry + shared types. Mirrors app/services/city_puzzle_builder.py
// (CITY_MODE_CITIES). The `key` is the stable slug used as the DB key, the route
// segment, and the localStorage namespace.

import type { Hints } from "./types";

// Production release switch: hides the Steden tab and 404s the /city route until
// NEXT_PUBLIC_CITY_ENABLED=1 is set (lets you merge/deploy the code before the
// mode goes live). Always on outside production so local dev/preview can play it.
// This is a build-time constant, so flipping it means a redeploy — no code change.
export function isCityEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CITY_ENABLED === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export type CityInfo = { key: string; display: string };

export const CITIES: CityInfo[] = [
  { key: "amsterdam", display: "Amsterdam" },
  { key: "rotterdam", display: "Rotterdam" },
  { key: "den-haag", display: "Den Haag" },
  { key: "utrecht", display: "Utrecht" },
  { key: "eindhoven", display: "Eindhoven" },
  { key: "groningen", display: "Groningen" },
  { key: "tilburg", display: "Tilburg" },
  { key: "almere", display: "Almere" },
  { key: "den-bosch", display: "Den Bosch" },
  { key: "nijmegen", display: "Nijmegen" },
];

export const CITY_BY_KEY: Record<string, CityInfo> = Object.fromEntries(
  CITIES.map((c) => [c.key, c])
);

// The listing + clues shown while bidding (never includes the price).
export type CityPuzzleView = {
  city: string; // slug
  cityDisplay: string;
  puzzle_number: number;
  closes_at: string; // ISO8601
  photos: string[];
  hints: Hints;
  url: string | null; // Funda listing link (shown after reveal)
};

// Reveal RPC result. Before closes_at only `open`/`your_bid` are meaningful;
// after, the full outcome is present.
export type CityReveal = {
  open: boolean;
  closes_at: string;
  your_bid: number | null;
  answer_eur?: number;
  your_distance?: number | null;
  your_rank?: number | null;
  winning_distance?: number | null;
  total_bids?: number;
  won?: boolean;
};
