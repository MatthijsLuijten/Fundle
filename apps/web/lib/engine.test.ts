import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/parity.json";
import {
  buildPhotoOrder,
  computeState,
  decodeAnswer,
  evaluateGuess,
  formatListedAgo,
  obfuscateAnswer,
  puzzleNumberForDate,
  type GameState,
  type Puzzle,
} from "./engine";

describe("obfuscation round-trip", () => {
  it("decodes what it encodes across a range of prices", () => {
    for (const n of [0, 1000, 149_999, 500_000, 1_234_567, 9_999_999]) {
      expect(decodeAnswer(obfuscateAnswer(n))).toBe(n);
    }
  });
});

describe("evaluateGuess", () => {
  it("treats within 2% as correct", () => {
    expect(evaluateGuess(100_000, 101_000).correct).toBe(true);
  });
  it("flags too high / too low", () => {
    expect(evaluateGuess(100_000, 150_000)).toMatchObject({ correct: false, direction: "high" });
    expect(evaluateGuess(100_000, 50_000)).toMatchObject({ correct: false, direction: "low" });
  });
  it("only exact matches a zero answer", () => {
    expect(evaluateGuess(0, 0).correct).toBe(true);
    expect(evaluateGuess(0, 100).correct).toBe(false);
  });
});

describe("puzzleNumberForDate", () => {
  it("counts days from the 2026-01-01 epoch", () => {
    expect(puzzleNumberForDate("2026-01-01")).toBe(1);
    expect(puzzleNumberForDate("2026-01-02")).toBe(2);
    expect(puzzleNumberForDate("2026-01-08")).toBe(8);
  });
});

describe("buildPhotoOrder", () => {
  it("returns empty for no photos and identity for one", () => {
    expect(buildPhotoOrder({})).toEqual([]);
    expect(buildPhotoOrder({ photo_urls: ["u0"] })).toEqual(["u0"]);
  });
  it("keeps the hero photo first and spreads the rest", () => {
    const order = buildPhotoOrder({ photo_urls: ["u0", "u1", "u2", "u3", "u4"] });
    expect(order[0]).toBe("u0");
    expect(order.length).toBeGreaterThan(1);
  });
});

describe("formatListedAgo", () => {
  it("matches the Dutch wording from the backend", () => {
    expect(formatListedAgo("2026-03-01T00:00:00Z", "2026-03-15")).toBe("2 weken online");
    expect(formatListedAgo("2026-03-14T00:00:00Z", "2026-03-15")).toBe("Gisteren online gezet");
    expect(formatListedAgo(undefined, "2026-03-15")).toBeNull();
  });
});

// parity.json is a frozen golden fixture: it was generated once from the old
// Python reference implementation (since removed) and is now checked in as the
// source of truth for engine.ts's output. Regenerate only if you deliberately
// change engine behavior — and review the diff carefully.
describe("golden PuzzleState fixtures", () => {
  for (const fx of fixtures as Array<{
    name: string;
    puzzle: Puzzle;
    game: GameState;
    lastGuess: { correct: boolean; direction: "high" | "low" | null };
    sessionId: string;
    expected: unknown;
  }>) {
    it(`produces identical PuzzleState: ${fx.name}`, () => {
      const state = computeState(fx.puzzle, fx.game, fx.sessionId, fx.lastGuess);
      expect(state).toEqual(fx.expected);
    });
  }
});
