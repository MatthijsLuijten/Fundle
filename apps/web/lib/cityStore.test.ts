import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCityBid, saveCityBid } from "./cityStore";

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

describe("loadCityBid", () => {
  it("returns the bid for a city that has one", () => {
    saveCityBid("amsterdam", DATE, 500000);

    expect(loadCityBid("amsterdam", DATE)?.bid).toBe(500000);
  });

  it("is scoped per day, so yesterday's bid does not leak into today", () => {
    saveCityBid("amsterdam", "2026-08-06", 500000);

    expect(loadCityBid("amsterdam", DATE)).toBeNull();
    expect(loadCityBid("amsterdam", "2026-08-06")?.bid).toBe(500000);
  });

  it("returns null when nothing has been bid", () => {
    expect(loadCityBid("amsterdam", DATE)).toBeNull();
  });
});
