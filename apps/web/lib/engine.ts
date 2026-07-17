// Client-side game engine: a faithful TypeScript port of the pure logic that
// used to live in the FastAPI backend (apps/api/app/services/game.py and
// hints.py). Given a puzzle payload + local game state it produces the exact
// same PuzzleState shape the API used to return, so the UI is unchanged.

import type { GameResult, Hints, PuzzleState } from "./types";

export const MAX_GUESSES = 5;
export const MAX_HINT_LEVEL = 4;
export const PHOTOS_PER_GUESS = 2;
export const UNLOCK_PHOTO_SLOTS = PHOTOS_PER_GUESS * MAX_GUESSES;
export const TOLERANCE_PCT = 0.02; // within 2% counts as correct

const PUZZLE_EPOCH = Date.UTC(2026, 0, 1);
const MS_PER_DAY = 86_400_000;

// --- Answer obfuscation (shared, reversible) --------------------------------
// Mirrors apps/api/app/obfuscate.py. Not encryption — just enough so the answer
// isn't sitting in plain sight in the network tab. Reversible with a few lines.
const OBF_K = 7919;
const OBF_S = 104729;

export function obfuscateAnswer(answer: number): string {
  return btoa(String(answer * OBF_K + OBF_S));
}

export function decodeAnswer(token: string): number {
  return Math.round((Number(atob(token)) - OBF_S) / OBF_K);
}

// --- Puzzle numbering -------------------------------------------------------
function dateToUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function puzzleNumberForDate(isoDate: string): number {
  return Math.round((dateToUtcMs(isoDate) - PUZZLE_EPOCH) / MS_PER_DAY) + 1;
}

export function amsterdamToday(): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// --- Photo reveal logic (port of game.py) -----------------------------------
type Payload = Record<string, unknown>;

function photoPool(payload: Payload): string[] {
  const urls = ((payload.photo_urls as string[] | undefined) ?? []).filter(
    (u): u is string => Boolean(u)
  );
  if (urls.length) return urls;
  const single = payload.photo_url as string | undefined;
  return single ? [single] : [];
}

function indexAtPercentile(slot: number, totalSlots: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(1, Math.floor((slot * (count - 1)) / (totalSlots + 1))));
}

function nearestUnusedIndex(target: number, count: number, used: Set<number>): number {
  if (!used.has(target)) return target;
  for (let offset = 1; offset < count; offset++) {
    for (const candidate of [target + offset, target - offset]) {
      if (candidate >= 0 && candidate < count && !used.has(candidate)) return candidate;
    }
  }
  return target;
}

function pickIndicesAtPercentiles(count: number, slots: number, used: Set<number>): number[] {
  const picked: number[] = [];
  for (let slot = 1; slot <= slots; slot++) {
    const target = indexAtPercentile(slot, slots, count);
    const index = nearestUnusedIndex(target, count, used);
    if (used.has(index)) continue;
    used.add(index);
    picked.push(index);
  }
  return picked;
}

export function buildPhotoOrder(payload: Payload): string[] {
  const pool = photoPool(payload);
  if (!pool.length) return [];
  if (pool.length === 1) return pool;

  const used = new Set<number>([0]);
  const indices = [0];
  const unlockSlots = Math.min(UNLOCK_PHOTO_SLOTS, pool.length - 1);
  indices.push(...pickIndicesAtPercentiles(pool.length, unlockSlots, used));
  return indices.map((i) => pool[i]);
}

// How many photos are unlocked after `guessesCount` guesses. Normally a fresh
// batch lands *after* each guess, to help the next one. On the final guess that
// batch would only appear once no guesses remain (useless), so we front-load the
// remaining photos onto the last guess instead — the highest-stakes guess gets
// the most to work with.
function unlockedPhotoCount(guessesCount: number, total: number): number {
  if (guessesCount >= MAX_GUESSES - 1) return total;
  return Math.min(1 + PHOTOS_PER_GUESS * guessesCount, total);
}

function revealedPhotos(order: string[], guessesCount: number, status: GameState["status"]): string[] {
  if (!order.length) return [];
  if (status === "won") return order;
  return order.slice(0, unlockedPhotoCount(guessesCount, order.length));
}

// --- Hints (port of hints.py) -----------------------------------------------
const HINT_KEYS_BY_LEVEL: Record<number, string[]> = {
  0: ["object_type", "city", "province"],
  1: ["living_area", "energy_label"],
  2: ["construction_year", "rooms_count"],
  3: ["bedrooms", "insulation"],
  4: ["neighbourhood", "plot_area", "house_type", "sustainability_measures"],
};

function hintValuePresent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hintsForLevel(payload: Payload, hintLevel: number): Payload {
  const out: Payload = {};
  for (let level = 0; level <= Math.min(hintLevel, MAX_HINT_LEVEL); level++) {
    for (const key of HINT_KEYS_BY_LEVEL[level] ?? []) {
      const value = payload[key];
      if (hintValuePresent(value)) out[key] = value;
    }
  }
  return out;
}

function hintsAtLevel(payload: Payload, hintLevel: number): Payload {
  const out: Payload = {};
  for (const key of HINT_KEYS_BY_LEVEL[hintLevel] ?? []) {
    const value = payload[key];
    if (hintValuePresent(value)) out[key] = value;
  }
  return out;
}

function formatObjectType(value: unknown): string {
  const map: Record<string, string> = { house: "Woning", apartment: "Appartement" };
  const key = (value as string) ?? "";
  return map[key] ?? (key || "Onbekend");
}

function humanizeHints(hints: Payload): Hints {
  const display: Hints = {};
  if ("object_type" in hints) display.property = formatObjectType(hints.object_type);
  for (const key of ["city", "province", "neighbourhood", "living_area", "plot_area", "energy_label"]) {
    if (key in hints) display[key] = hints[key] as string | number;
  }
  if ("bedrooms" in hints) display.bedrooms = hints.bedrooms as string | number;
  if ("rooms_count" in hints) display.rooms = hints.rooms_count as string | number;
  if ("construction_year" in hints) display.year = hints.construction_year as string | number;
  if ("house_type" in hints) display.house_type = hints.house_type as string | number;
  if ("insulation" in hints) display.insulation = hints.insulation as string | number;
  const measures = hints.sustainability_measures as string[] | undefined;
  if (measures && measures.length) display.sustainability = measures.join(" · ");
  return display;
}

// All hints at once (city mode shows everything upfront — no progressive tiers).
export function fullHints(payload: Payload): Hints {
  return humanizeHints(hintsForLevel(payload, MAX_HINT_LEVEL));
}

function newHintsForLevel(
  payload: Payload,
  hintLevel: number,
  guessesCount: number,
  status: GameState["status"]
): Hints {
  if (guessesCount === 0) return {};
  if (status === "won") {
    const prevLevel = Math.min(guessesCount - 1, MAX_HINT_LEVEL);
    const prevHints = humanizeHints(hintsForLevel(payload, prevLevel));
    const allHints = humanizeHints(hintsForLevel(payload, MAX_HINT_LEVEL));
    const result: Hints = {};
    for (const [key, value] of Object.entries(allHints)) {
      if (!(key in prevHints)) result[key] = value;
    }
    return result;
  }
  return humanizeHints(hintsAtLevel(payload, hintLevel));
}

export function formatListedAgo(publicationDate: string | undefined, referenceIso: string): string | null {
  if (!publicationDate) return null;
  const published = new Date(publicationDate.replace("Z", "+00:00"));
  if (Number.isNaN(published.getTime())) return null;

  const publishedDay = Date.UTC(
    published.getUTCFullYear(),
    published.getUTCMonth(),
    published.getUTCDate()
  );
  const days = Math.floor((dateToUtcMs(referenceIso) - publishedDay) / MS_PER_DAY);
  if (days < 0) return null;
  if (days === 0) return "Vandaag online gezet";
  if (days === 1) return "Gisteren online gezet";
  if (days < 7) return `${days} dagen online`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weken"} online`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "maand" : "maanden"} online`;
  }
  const years = Math.floor(days / 365);
  return `${years} jaar online`;
}

// --- Funda URL (port of funda_url.py) ---------------------------------------
export function fundaListingUrl(payload: Payload): string | null {
  const url = payload.url;
  if (typeof url === "string" && url.includes("funda.nl/detail/")) {
    return url.split("?")[0].split("#")[0];
  }
  const path = payload.detail_path;
  if (typeof path === "string" && path.startsWith("/detail/")) {
    return `https://www.funda.nl${path.split("?")[0].split("#")[0]}`;
  }
  return null;
}

// --- Guess evaluation -------------------------------------------------------
export type GuessOutcome = { correct: boolean; direction: "high" | "low" | null; delta: number };

export function evaluateGuess(answer: number, guess: number): GuessOutcome {
  if (answer === 0) {
    return { correct: guess === answer, direction: null, delta: 0 };
  }
  const delta = guess - answer;
  const pctDiff = Math.abs(delta) / answer;
  if (pctDiff <= TOLERANCE_PCT) {
    return { correct: true, direction: null, delta: Math.abs(delta) };
  }
  return { correct: false, direction: delta > 0 ? "high" : "low", delta: Math.abs(delta) };
}

function formatPrice(answer: number): string {
  return `€${new Intl.NumberFormat("nl-NL").format(answer)}`;
}

function resultPayload(puzzle: Puzzle, won: boolean): GameResult {
  return {
    won,
    answer_eur: puzzle.answer_eur,
    formatted_price: formatPrice(puzzle.answer_eur),
    url: fundaListingUrl(puzzle.payload),
    city: (puzzle.payload.city as string) ?? null,
    listed_ago: formatListedAgo(puzzle.payload.publication_date as string | undefined, puzzle.puzzle_date),
    // Filled in from Supabase puzzle_stats by api.ts (the engine is offline/pure).
    community_finished: 0,
    community_won: 0,
  };
}

// --- State composition (port of game.py::session_state) ---------------------
export type Puzzle = {
  puzzle_date: string;
  puzzle_number: number;
  payload: Payload;
  answer_eur: number;
};

export type GameState = {
  guesses: PuzzleState["guesses"];
  status: "playing" | "won" | "lost";
  hint_level: number;
  reported?: boolean;
};

export function computeState(
  puzzle: Puzzle,
  game: GameState,
  sessionId: string,
  lastGuess?: { correct: boolean; direction: "high" | "low" | null }
): PuzzleState {
  const order = buildPhotoOrder(puzzle.payload);
  const guessesCount = game.guesses.length;
  const terminal = game.status === "won" || game.status === "lost";

  const hintLevel = terminal ? MAX_HINT_LEVEL : game.hint_level;
  const rawHints = hintsForLevel(puzzle.payload, hintLevel);
  const photos = revealedPhotos(order, guessesCount, game.status);

  let newPhotoUrls: string[] = [];
  if (guessesCount > 0) {
    const prevUnlocked = unlockedPhotoCount(guessesCount - 1, order.length);
    if (game.status === "won") {
      // Winning reveals the full gallery; mark every newly visible photo as "nieuw".
      newPhotoUrls = photos.slice(prevUnlocked);
    } else {
      const unlocked = unlockedPhotoCount(guessesCount, order.length);
      newPhotoUrls = photos.slice(prevUnlocked, unlocked);
    }
  }

  return {
    puzzle_date: puzzle.puzzle_date,
    puzzle_number: puzzle.puzzle_number,
    session_id: sessionId,
    correct: lastGuess?.correct ?? false,
    direction: lastGuess?.direction ?? null,
    guesses_used: guessesCount,
    max_guesses: MAX_GUESSES,
    hint_level: hintLevel,
    status: game.status,
    hints: humanizeHints(rawHints),
    new_hints: newHintsForLevel(puzzle.payload, game.hint_level, guessesCount, game.status),
    new_photo_urls: newPhotoUrls,
    revealed_photos: photos,
    guesses: game.guesses,
    result: terminal ? resultPayload(puzzle, game.status === "won") : null,
  };
}
