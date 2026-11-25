import { describe, expect, it } from "vitest";
import { artKicker, formatArtDate, shiftArtDate } from "./art-date";

describe("art date helpers", () => {
  it("steps across month, year and leap-day boundaries in UTC", () => {
    expect(shiftArtDate("2026-11-25", -1)).toBe("2026-11-24");
    expect(shiftArtDate("2026-10-27", -1)).toBe("2026-10-26");
    expect(shiftArtDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftArtDate("2024-12-31", 1)).toBe("2025-01-01");
    expect(shiftArtDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("labels today and past days without the visitor's timezone", () => {
    expect(formatArtDate("2026-11-25", "2026-11-25")).toBe("Today");
    expect(formatArtDate("2026-11-24", "2026-11-25")).toBe("Nov 24");
    expect(formatArtDate("2026-10-27", "2026-11-25")).toBe("Oct 27");
  });

  it("writes the wall kicker in the card's voice", () => {
    expect(artKicker("2026-11-25", "2026-11-25")).toBe("Today’s painting");
    expect(artKicker("2026-11-24", "2026-11-25")).toBe(
      "Daily painting · Nov 24",
    );
  });
});
