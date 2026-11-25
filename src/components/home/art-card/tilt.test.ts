import { describe, expect, it } from "vitest";
import { tiltForDate } from "./tilt";

describe("tiltForDate", () => {
  it("is stable for a day", () => {
    expect(tiltForDate("2026-11-25")).toBe(tiltForDate("2026-11-25"));
  });

  it("stays between 1.05° and 1.85° either way", () => {
    for (const date of [
      "2026-11-25",
      "2026-11-24",
      "2026-10-27",
      "2027-01-01",
      "2024-02-29",
    ]) {
      const tilt = tiltForDate(date);

      expect(Math.abs(tilt)).toBeGreaterThanOrEqual(1.05);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(1.85);
    }
  });

  it("changes with the day", () => {
    expect(tiltForDate("2026-11-25")).not.toBe(tiltForDate("2026-11-26"));
  });
});
