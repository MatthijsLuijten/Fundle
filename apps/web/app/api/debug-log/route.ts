// Dev-only: lets the client surface the puzzle answer in the `next dev` terminal
// (the browser can't write there). Replaces the old API-server log that printed
// price+city when DEBUG_FRESH rebuilt the puzzle each refresh.
//
// Guarded to development so it's a no-op in production — the client also only
// calls it when DEBUG_FRESH=1, so it never runs for real players.

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const { puzzleNumber, answer, city } = await req.json();
  const price = typeof answer === "number" ? answer.toLocaleString("nl-NL") : String(answer);
  // \x1b[92m … \x1b[0m = green, matching the builder's terminal output.
  console.info(`\x1b[92m[Fundle debug] #${puzzleNumber} antwoord €${price} — ${city ?? "?"}\x1b[0m`);

  return new Response(null, { status: 204 });
}
