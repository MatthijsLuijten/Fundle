// Gameplay used to be server calls; now it runs entirely in the browser.
// fetchToday/submitGuess keep the same async signatures so the UI is unchanged,
// but they read the daily puzzle from Supabase and drive a local game engine.

import { computeState, decodeAnswer, evaluateGuess, MAX_GUESSES, type Puzzle } from "./engine";
import { clearGame, defaultGame, loadGame, saveGame } from "./gameStore";
import { fetchStats, fetchTodayPuzzleRow, recordResult, type PuzzleRow } from "./supabase";
import { getOrCreateSessionId, isDebugFresh } from "./storage";
import type { PuzzleState } from "./types";

let currentPuzzle: Puzzle | null = null;

// On a finished game, fill the result's community counts from puzzle_stats.
// Best-effort: leave the zeros from the engine if stats can't be read.
async function withCommunity(state: PuzzleState): Promise<PuzzleState> {
  if (!state.result) return state;
  try {
    const stats = await fetchStats(state.puzzle_date);
    if (stats) {
      return {
        ...state,
        result: { ...state.result, community_finished: stats.plays, community_won: stats.solves },
      };
    }
  } catch {
    // ignore — keep zeros
  }
  return state;
}

function toPuzzle(row: PuzzleRow): Puzzle {
  currentPuzzle = {
    puzzle_date: row.puzzle_date,
    puzzle_number: row.puzzle_number,
    payload: row.payload,
    answer_eur: decodeAnswer(row.answer_token),
  };
  return currentPuzzle;
}

// Dev only: ping a route handler that console.logs the answer server-side, so it
// shows in the `npm run dev` terminal (the browser can't write there). No UI change.
function logDebugAnswer(puzzle: Puzzle): void {
  fetch("/api/debug", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      puzzleNumber: puzzle.puzzle_number,
      answer: puzzle.answer_eur,
      city: (puzzle.payload.city as string) ?? null,
    }),
  }).catch(() => {});
}

export async function fetchToday(): Promise<PuzzleState> {
  if (isDebugFresh()) {
    const res = await fetch("/api/debug");
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? `Failed to fetch random puzzle (${res.status})`);
    }
    const puzzle = toPuzzle((await res.json()) as PuzzleRow);
    logDebugAnswer(puzzle); // prints price+city to the dev terminal
    clearGame(puzzle.puzzle_date);
    return computeState(puzzle, defaultGame(), getOrCreateSessionId());
  }
  const puzzle = toPuzzle(await fetchTodayPuzzleRow());
  const game = loadGame(puzzle.puzzle_date) || defaultGame();
  return withCommunity(computeState(puzzle, game, getOrCreateSessionId()));
}

export async function submitGuess(amount: number): Promise<PuzzleState> {
  // fetchToday always runs first and sets currentPuzzle; this is just a safety net.
  const puzzle = currentPuzzle ?? toPuzzle(await fetchTodayPuzzleRow());
  const sessionId = getOrCreateSessionId();
  const game = loadGame(puzzle.puzzle_date) || defaultGame();

  if (game.status !== "playing") {
    return withCommunity(computeState(puzzle, game, sessionId));
  }

  const { correct, direction } = evaluateGuess(puzzle.answer_eur, amount);
  game.guesses = [...game.guesses, { amount, direction }];

  if (correct) {
    game.status = "won";
    game.hint_level = MAX_GUESSES - 1; // == MAX_HINT_LEVEL (4)
  } else if (game.guesses.length >= MAX_GUESSES) {
    game.status = "lost";
  } else {
    game.hint_level = Math.min(game.hint_level + 1, MAX_GUESSES - 1);
  }
  saveGame(puzzle.puzzle_date, game);

  if (game.status !== "playing" && !game.reported) {
    // Debug sessions must not pollute the shared community stats.
    if (!isDebugFresh()) {
      const bucket = game.status === "won" ? game.guesses.length : 6;
      // Awaited so the community counts we read back include this result.
      try {
        await recordResult(puzzle.puzzle_date, game.status === "won", bucket);
      } catch {
        // best-effort: never let community-stats reporting break gameplay
      }
    }
    game.reported = true;
    saveGame(puzzle.puzzle_date, game);
  }

  return withCommunity(computeState(puzzle, game, sessionId, { correct, direction }));
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
