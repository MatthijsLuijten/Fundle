import type { PuzzleState } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchToday(sessionId?: string): Promise<PuzzleState> {
  const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`${API_URL}/api/v1/puzzle/today${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load today's puzzle");
  return res.json();
}

export async function submitGuess(
  amount: number,
  sessionId?: string
): Promise<PuzzleState> {
  const res = await fetch(`${API_URL}/api/v1/puzzle/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId ?? null, amount }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Guess failed");
  }
  return res.json();
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
