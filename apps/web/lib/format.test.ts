import { describe, expect, it } from "vitest";
import { formatInputDigits, formatInputWithCursor } from "./format";

describe("formatInputDigits", () => {
  it("formats Dutch thousands separators", () => {
    expect(formatInputDigits("450000")).toBe("450.000");
  });

  it("strips non-digits", () => {
    expect(formatInputDigits("450.000")).toBe("450.000");
  });
});

describe("formatInputWithCursor", () => {
  it("keeps cursor after inserted digit in the middle", () => {
    const { value, cursorPos } = formatInputWithCursor("41.50.000", 2);
    expect(value).toBe("4.150.000");
    expect(value.slice(0, cursorPos).replace(/\D/g, "")).toBe("41");
  });

  it("keeps cursor at start when typing first digit", () => {
    const { value, cursorPos } = formatInputWithCursor("4", 1);
    expect(value).toBe("4");
    expect(cursorPos).toBe(1);
  });

  it("keeps cursor at end when appending", () => {
    const { value, cursorPos } = formatInputWithCursor("450.0001", 8);
    expect(value).toBe("4.500.001");
    expect(cursorPos).toBe(value.length);
  });
});
