import { describe, expect, it } from "vitest";
import { bidDistance, computeOutcome } from "./cityEngine";

describe("bidDistance", () => {
  it("is absolute", () => {
    expect(bidDistance(300000, 305000)).toBe(5000);
    expect(bidDistance(300000, 295000)).toBe(5000);
  });
});

describe("computeOutcome", () => {
  it("wins when strictly closest", () => {
    const o = computeOutcome(300000, 301000, [310000, 280000, 350000]);
    expect(o.won).toBe(true);
    expect(o.your_rank).toBe(1);
    expect(o.your_distance).toBe(1000);
    expect(o.winning_distance).toBe(1000);
    expect(o.total_bids).toBe(4);
  });

  it("loses a tie to an earlier opponent (first bid wins)", () => {
    // Opponent bid the same distance but earlier -> player ranks behind.
    const o = computeOutcome(300000, 305000, [295000, 250000]);
    expect(o.won).toBe(false);
    expect(o.your_rank).toBe(2);
    expect(o.winning_distance).toBe(5000);
  });

  it("ranks a far bid last", () => {
    const o = computeOutcome(300000, 200000, [305000, 295000, 310000]);
    expect(o.your_rank).toBe(4);
    expect(o.won).toBe(false);
    expect(o.your_distance).toBe(100000);
    expect(o.winning_distance).toBe(5000);
  });

  it("wins uncontested with no opponents", () => {
    const o = computeOutcome(300000, 400000, []);
    expect(o.won).toBe(true);
    expect(o.your_rank).toBe(1);
    expect(o.total_bids).toBe(1);
  });
});
