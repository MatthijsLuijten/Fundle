import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCityBid, loadCityBids, saveCityBid } from "./cityStore";

// Same minimal browser stubs as cityMock.test.ts so this node-env test can
// drive the localStorage-backed store.
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as unknown as { window: unknown }).window = {};
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

const DATE = "2026-08-07";

describe("loadCityBids", () => {
  it("returns only the cities that have a bid for that date", () => {
    saveCityBid("amsterdam", DATE, 500000);
    saveCityBid("utrecht", DATE, 425000);

    const bids = loadCityBids(["amsterdam", "rotterdam", "utrecht"], DATE);

    expect(Object.keys(bids).sort()).toEqual(["amsterdam", "utrecht"]);
    expect(bids.amsterdam.bid).toBe(500000);
    expect(bids.utrecht.bid).toBe(425000);
  });

  it("is scoped per day, so yesterday's bids do not leak into today", () => {
    saveCityBid("amsterdam", "2026-08-06", 500000);

    expect(loadCityBids(["amsterdam"], DATE)).toEqual({});
    expect(loadCityBid("amsterdam", "2026-08-06")?.bid).toBe(500000);
  });

  it("returns an empty map when nothing has been bid", () => {
    expect(loadCityBids(["amsterdam", "rotterdam"], DATE)).toEqual({});
  });
});
