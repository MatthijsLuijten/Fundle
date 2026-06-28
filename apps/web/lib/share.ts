import { getStats } from "./stats";
import type { GuessRecord, PuzzleState } from "./types";

function propertyEmoji(hints: PuzzleState["hints"]): string {
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

export function buildShareText(state: PuzzleState): string {
  const { puzzle_number, guesses, max_guesses, status, hints } = state;
  const guessCount = guesses.length;

  const resultLine =
    status === "won"
      ? `${guessCount}/${max_guesses}`
      : `X/${max_guesses}`;
  const mood =
    status === "won" ? " 🎉" : status === "lost" ? " 😅" : "";
  const title = `${propertyEmoji(hints)} Fundle #${puzzle_number} ${resultLine}${mood}`;

  const city =
    typeof hints.city === "string" && hints.city.trim()
      ? `📍 ${hints.city.trim()}`
      : null;

  const squares = Array.from({ length: max_guesses }, (_, i) =>
    guessEmoji(guesses[i], i, guessCount, status)
  ).join("");

  const lines = [title];
  if (city) lines.push(city);
  lines.push(squares);

  const { currentStreak, currentWinStreak } = getStats();
  if (currentStreak > 0) {
    lines.push(`🔥 speelstreak: ${currentStreak}`);
  }
  if (currentWinStreak > 0) {
    lines.push(`🎯 winstreak: ${currentWinStreak}`);
  }

  const url =
    typeof window !== "undefined" ? window.location.origin : "fundle.nl";
  lines.push("", url);

  return lines.join("\n");
}

export async function copyResult(state: PuzzleState): Promise<boolean> {
  const text = buildShareText(state);

  try {
    await navigator.clipboard.writeText(text);
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
