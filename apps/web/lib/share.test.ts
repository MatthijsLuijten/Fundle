import { describe, expect, it } from "vitest";
import { buildCityShareText, type CityShareData, type DailyResultSummary } from "./share";

const winCity: CityShareData = {
  cityDisplay: "Rotterdam",
  won: true,
  your_rank: 1,
  total_bids: 27,
  your_distance: 3000,
};

const loseCity: CityShareData = {
  cityDisplay: "Utrecht",
  won: false,
  your_rank: 8,
  total_bids: 27,
  your_distance: 12000,
};

const daily: DailyResultSummary = {
  puzzle_number: 198,
  status: "won",
  max_guesses: 5,
  guesses: [
    { amount: 1, direction: "low" },
    { amount: 2, direction: "high" },
    { amount: 3, direction: null },
  ],
  city: "Amsterdam",
  property_emoji: "🏠",
};

describe("buildCityShareText", () => {
  it("includes the city placement and a share url", () => {
    const text = buildCityShareText(winCity, null);
    expect(text).toContain("🏙️ Fundle Steden · Rotterdam");
    expect(text).toContain("🥇 1e van 27 · huis binnen!");
    expect(text).toContain("🎯 €3.000 eraf");
    expect(text.trimEnd().endsWith("fundle.nl") || text.includes("http")).toBe(true);
  });

  it("uses a medal but no 'huis binnen' when not won", () => {
    const text = buildCityShareText(loseCity, null);
    expect(text).toContain("🏅 8e van 27");
    expect(text).not.toContain("huis binnen");
  });

  it("stacks the daily result on top when provided", () => {
    const text = buildCityShareText(winCity, daily);
    const dailyIdx = text.indexOf("Fundle #198");
    const cityIdx = text.indexOf("Fundle Steden");
    expect(dailyIdx).toBeGreaterThanOrEqual(0);
    expect(cityIdx).toBeGreaterThan(dailyIdx); // daily on top, city below
    expect(text).toContain("📍 Amsterdam");
    expect(text).toContain("🟩"); // daily squares present
  });

  it("omits the daily block entirely when daily wasn't played", () => {
    const text = buildCityShareText(winCity, null);
    expect(text).not.toContain("Fundle #");
  });
});
