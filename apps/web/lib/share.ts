import { amsterdamToday } from "./engine";
import { getStats } from "./stats";
import type { GuessRecord, Hints, PuzzleState } from "./types";

function propertyEmoji(hints: Hints): string {
  const prop = hints.property;
  if (typeof prop === "string" && prop.toLowerCase().includes("appartement")) {
    return "🏢";
  }
  return "🏠";
}

function guessEmoji(
  guess: GuessRecord | undefined,
  index: number,
  guessCount: number,
  status: PuzzleState["status"]
): string {
  if (index >= guessCount) return "⬜";
  if (status === "won" && index === guessCount - 1) return "🟩";
  if (guess?.direction === "high") return "🔼";
  if (guess?.direction === "low") return "🔽";
  return "🟥";
}

function shareUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "fundle.nl";
}

// --- Daily result summary --------------------------------------------------
// Persisted when a daily game ends so other screens (e.g. the city reveal) can
// include today's daily result in a combined share, without refetching.
export type DailyResultSummary = {
  puzzle_number: number;
  status: PuzzleState["status"];
  max_guesses: number;
  guesses: GuessRecord[];
  city: string | null;
  property_emoji: string;
};

const DAILY_RESULT_PREFIX = "fundle_daily_result_";

function summaryFromState(state: PuzzleState): DailyResultSummary {
  const city =
    typeof state.hints.city === "string" && state.hints.city.trim()
      ? state.hints.city.trim()
      : null;
  return {
    puzzle_number: state.puzzle_number,
    status: state.status,
    max_guesses: state.max_guesses,
    guesses: state.guesses,
    city,
    property_emoji: propertyEmoji(state.hints),
  };
}

export function saveDailyResult(state: PuzzleState): void {
  if (typeof window === "undefined" || state.status === "playing") return;
  try {
    localStorage.setItem(
      DAILY_RESULT_PREFIX + state.puzzle_date,
      JSON.stringify(summaryFromState(state))
    );
  } catch {
    // ignore — sharing the daily result is best-effort
  }
}

export function loadDailyResult(date: string): DailyResultSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_RESULT_PREFIX + date);
    return raw ? (JSON.parse(raw) as DailyResultSummary) : null;
  } catch {
    return null;
  }
}

function dailyLines(s: DailyResultSummary): string[] {
  const guessCount = s.guesses.length;
  const resultLine = s.status === "won" ? `${guessCount}/${s.max_guesses}` : `X/${s.max_guesses}`;
  const mood = s.status === "won" ? " 🎉" : s.status === "lost" ? " 😅" : "";

  const lines = [`${s.property_emoji} Fundle #${s.puzzle_number} ${resultLine}${mood}`];
  if (s.city) lines.push(`📍 ${s.city}`);
  lines.push(
    Array.from({ length: s.max_guesses }, (_, i) =>
      guessEmoji(s.guesses[i], i, guessCount, s.status)
    ).join("")
  );

  const { currentStreak, currentWinStreak } = getStats();
  if (currentStreak > 0) lines.push(`🔥 speelstreak: ${currentStreak}`);
  if (currentWinStreak > 0) lines.push(`🎯 winstreak: ${currentWinStreak}`);
  return lines;
}

export function buildShareText(state: PuzzleState): string {
  const lines = dailyLines(summaryFromState(state));
  lines.push("", shareUrl());
  return lines.join("\n");
}

export async function copyResult(state: PuzzleState): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildShareText(state));
    return true;
  } catch {
    return false;
  }
}

export async function shareResult(state: PuzzleState): Promise<boolean> {
  const text = buildShareText(state);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
    }
  }
  return false;
}

// --- City (Steden) share ---------------------------------------------------
// Combines today's daily result (top, if the player played it) with the city
// placement below. Works whether or not daily was played.
export type CityShareData = {
  cityDisplay: string;
  won: boolean;
  your_rank: number | null;
  total_bids: number;
  your_distance: number | null;
};

function stedenLines(c: CityShareData): string[] {
  const lines = [`🏙️ Fundle Steden · ${c.cityDisplay}`];
  if (c.your_rank != null) {
    const medal = c.won ? "🥇" : "🏅";
    lines.push(`${medal} ${c.your_rank}e van ${c.total_bids}${c.won ? " · huis binnen!" : ""}`);
  } else {
    lines.push(`${c.total_bids} bieders`);
  }
  if (c.your_distance != null) {
    lines.push(`🎯 €${new Intl.NumberFormat("nl-NL").format(c.your_distance)} eraf`);
  }
  return lines;
}

export function buildCityShareText(
  city: CityShareData,
  daily: DailyResultSummary | null
): string {
  const lines: string[] = [];
  if (daily) lines.push(...dailyLines(daily), "");
  lines.push(...stedenLines(city));
  lines.push("", shareUrl());
  return lines.join("\n");
}

export async function copyCityResult(city: CityShareData): Promise<boolean> {
  const text = buildCityShareText(city, loadDailyResult(amsterdamToday()));
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareCityResult(city: CityShareData): Promise<boolean> {
  const text = buildCityShareText(city, loadDailyResult(amsterdamToday()));
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
    }
  }
  return false;
}
