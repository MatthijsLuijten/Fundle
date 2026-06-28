// Dev-only (DEBUG_FRESH=1): GET fetches a live random Funda listing via the Python
// builder; POST logs the answer in the `next dev` terminal (the browser can't write
// there). Both are 404 in production.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { amsterdamToday, puzzleNumberForDate } from "@/lib/engine";
import type { PuzzleRow } from "@/lib/supabase";

const exec = promisify(execFile);
const root = path.join(process.cwd(), "..", "..");
const isWin = process.platform === "win32";
const python = path.join(root, "apps", "api", ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");
const script = path.join(root, "scripts", "build_daily_puzzle.py");

function debugFresh(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEBUG_FRESH === "1";
}

export async function GET(): Promise<Response> {
  if (!debugFresh()) return new Response(null, { status: 404 });
  try {
    const { stdout } = await exec(python, [script, "--random"], { cwd: root, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
    const built = JSON.parse(stdout.trim()) as Pick<PuzzleRow, "global_id" | "answer_token" | "payload">;
    const puzzle_date = amsterdamToday();
    return Response.json({
      ...built,
      puzzle_date,
      puzzle_number: puzzleNumberForDate(puzzle_date),
    } satisfies PuzzleRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Random puzzle fetch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });

  const { puzzleNumber, answer, city } = await req.json();
  const price = typeof answer === "number" ? answer.toLocaleString("nl-NL") : String(answer);
  console.info(`\x1b[92m[Fundle debug] #${puzzleNumber} antwoord €${price} — ${city ?? "?"}\x1b[0m`);

  return new Response(null, { status: 204 });
}
