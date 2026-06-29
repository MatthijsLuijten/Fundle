import { describe, expect, it } from "vitest";
import {
  computeDifficultyVerdict,
  difficultyScore,
} from "./difficulty";
import type { StatsRow } from "./supabase";

function row(
  date: string,
  buckets: Record<string, number>
): StatsRow {
  const plays = Object.values(buckets).reduce((a, b) => a + b, 0);
  const solves = [1, 2, 3, 4, 5].reduce(
    (a, g) => a + (buckets[String(g)] ?? 0),
    0
  );
  return { puzzle_date: date, plays, solves, guess_buckets: buckets };
}

describe("difficultyScore", () => {
  it("averages guesses with a loss counting as 6", () => {
    // 10 wins in 2, 10 losses → (10*2 + 10*6) / 20 = 4
    expect(difficultyScore(row("2026-01-01", { "2": 10, "6": 10 }))).toBe(4);
  });

  it("ranks an all-first-guess day as easiest", () => {
    expect(difficultyScore(row("2026-01-01", { "1": 20 }))).toBe(1);
  });

  it("returns null below the minimum play count", () => {
    expect(difficultyScore(row("2026-01-01", { "1": 3 }))).toBeNull();
  });
});

describe("computeDifficultyVerdict", () => {
  const easy = (d: string) => row(d, { "1": 20 }); // score 1
  const mid = (d: string) => row(d, { "3": 20 }); // score 3
  const hard = (d: string) => row(d, { "5": 10, "6": 10 }); // score 5.5

  it("calls today harder than easier past puzzles", () => {
    const all = [easy("2026-01-01"), easy("2026-01-02"), easy("2026-01-03"), easy("2026-01-04"), hard("2026-01-05")];
    const v = computeDifficultyVerdict(all, "2026-01-05");
    expect(v).toEqual({ percentile: 100, harder: true });
  });

  it("calls today easier when it sits below the past median", () => {
    const all = [hard("2026-01-01"), hard("2026-01-02"), hard("2026-01-03"), hard("2026-01-04"), easy("2026-01-05")];
    const v = computeDifficultyVerdict(all, "2026-01-05");
    expect(v).toEqual({ percentile: 100, harder: false });
  });

  it("never reports a sub-50 percentile (flips to 'easier')", () => {
    const all = [easy("d1"), easy("d2"), easy("d3"), hard("d4"), mid("d5")];
    const v = computeDifficultyVerdict(all, "d5");
    // mid beats only the easy days (3 of 4 prior) → harder than 75%
    expect(v?.harder).toBe(true);
    expect(v?.percentile).toBeGreaterThanOrEqual(50);
  });

  it("returns null without any comparable history", () => {
    const all = [easy("2026-01-01"), hard("2026-01-02")];
    // The earliest puzzle has no prior puzzles to rank against.
    expect(computeDifficultyVerdict(all, "2026-01-01")).toBeNull();
  });

  it("ignores future puzzles when ranking", () => {
    const all = [
      easy("2026-01-01"),
      easy("2026-01-02"),
      easy("2026-01-03"),
      easy("2026-01-04"),
      mid("2026-01-05"),
      hard("2026-01-06"), // later than today; must not count
    ];
    const v = computeDifficultyVerdict(all, "2026-01-05");
    expect(v).toEqual({ percentile: 100, harder: true });
  });
});
