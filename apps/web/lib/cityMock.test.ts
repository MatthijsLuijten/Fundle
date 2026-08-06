import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/cityPuzzles.json";
import * as mock from "./cityMock";

// Read expectations from the (real Funda) fixtures so this test survives a
// regenerate via scripts/gen_city_fixtures.py.
type Fx = { answer_eur: number; payload: { city: string; photo_urls: string[] } };
const cities = (fixtures as unknown as { cities: Record<string, Fx> }).cities;
const [keyA, keyB] = Object.keys(cities);
const fxA = cities[keyA];
const fxB = cities[keyB];

// Minimal browser stubs so this node-env test can drive the offline backend
// end-to-end (fixtures + localStorage + the ?reveal=1 fast-forward).
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: "?reveal=1" },
  };
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

describe("cityMock offline backend", () => {
  it("serves a fixture puzzle with its real photos + hints", async () => {
    const v = await mock.fetchCityPuzzle(keyA);
    expect(v?.photos.length).toBe(fxA.payload.photo_urls.length);
    expect(v?.photos.length).toBeGreaterThan(0);
    expect(v?.hints.city).toBe(fxA.payload.city);
    expect(v?.cityDisplay).toBe(fxA.payload.city);
  });

  it("returns null for an unknown city", async () => {
    expect(await mock.fetchCityPuzzle("nope")).toBeNull();
  });

  it("keeps the first bid (first bid wins)", async () => {
    expect(await mock.submitCityBid(keyA, 500000)).toBe(500000);
    expect(await mock.submitCityBid(keyA, 999999)).toBe(500000);
  });

  it("reveals a complete outcome; an exact bid beats the field", async () => {
    await mock.submitCityBid(keyA, fxA.answer_eur); // exact — opponents are kept >=1.5% off
    const r = await mock.revealCity(keyA);
    expect(r?.open).toBe(false);
    expect(r?.answer_eur).toBe(fxA.answer_eur);
    expect(r?.your_bid).toBe(fxA.answer_eur);
    expect(r?.your_distance).toBe(0);
    expect(r?.won).toBe(true);
    expect(r?.total_bids ?? 0).toBeGreaterThan(1);
  });

  it("forces a win with ?reveal=win, no bid needed", async () => {
    (globalThis as unknown as { window: { location: { search: string } } }).window.location.search =
      "?reveal=win";
    const r = await mock.revealCity(keyA);
    expect(r?.open).toBe(false);
    expect(r?.won).toBe(true);
    expect(r?.your_rank).toBe(1);
    expect(r?.your_distance).toBe(0);
  });

  it("forces a loss with ?reveal=lose, no bid needed", async () => {
    (globalThis as unknown as { window: { location: { search: string } } }).window.location.search =
      "?reveal=lose";
    const r = await mock.revealCity(keyA);
    expect(r?.open).toBe(false);
    expect(r?.won).toBe(false);
    expect(r?.your_rank).toBe(r?.total_bids); // strictly worst
  });

  it("non-bidder still sees the price and field size", async () => {
    const r = await mock.revealCity(keyB);
    expect(r?.open).toBe(false);
    expect(r?.your_bid).toBeNull();
    expect(r?.won).toBe(false);
    expect(r?.answer_eur).toBe(fxB.answer_eur);
    expect(r?.total_bids ?? 0).toBeGreaterThan(0);
  });
});
