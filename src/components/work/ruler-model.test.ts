import { describe, expect, it } from "vitest";
import {
  clamp01,
  nearestSection,
  placeSectionTicks,
  RULER_MIN_TICKS,
  rulerTickCount,
  slugifyHeading,
  uniqueHeadingId,
} from "./ruler-model";

describe("slugifyHeading", () => {
  it("turns a heading into a fragment id", () => {
    expect(slugifyHeading("The system")).toBe("the-system");
    expect(slugifyHeading("What changed — and why")).toBe(
      "what-changed-and-why",
    );
    expect(slugifyHeading("  Ship / ship's done  ")).toBe("ship-ship-s-done");
  });

  it("drops diacritics rather than their letters", () => {
    expect(slugifyHeading("Café façade")).toBe("cafe-facade");
  });

  it("falls back to a usable id for text with no letters or digits", () => {
    expect(slugifyHeading("—")).toBe("section");
  });
});

describe("uniqueHeadingId", () => {
  it("suffixes a repeat instead of sharing one id", () => {
    const used = new Set<string>();

    expect(uniqueHeadingId("The system", used)).toBe("the-system");
    expect(uniqueHeadingId("The system", used)).toBe("the-system-2");
    expect(uniqueHeadingId("The system", used)).toBe("the-system-3");
    expect(uniqueHeadingId("The process", used)).toBe("the-process");
  });
});

describe("rulerTickCount", () => {
  it("keeps the reference density for 0, 1 and 4 sections", () => {
    expect(rulerTickCount(0)).toBe(RULER_MIN_TICKS);
    expect(rulerTickCount(1)).toBe(RULER_MIN_TICKS);
    expect(rulerTickCount(4)).toBe(RULER_MIN_TICKS);
  });

  it("grows so every section keeps its own tick", () => {
    expect(rulerTickCount(12)).toBe(RULER_MIN_TICKS);
    expect(rulerTickCount(24)).toBe(24);
  });
});

describe("placeSectionTicks", () => {
  it("places 4 sections on 17 ticks at their own positions", () => {
    expect(placeSectionTicks([0, 0.25, 0.5, 0.75], 17)).toEqual([0, 4, 8, 12]);
  });

  it("gives 12 sections 12 distinct ticks", () => {
    const progress = Array.from({ length: 12 }, (_, index) => index / 11);
    const ticks = placeSectionTicks(progress, rulerTickCount(12));

    expect(new Set(ticks).size).toBe(12);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it("moves a colliding section to the nearest free tick", () => {
    expect(placeSectionTicks([0, 0, 0], 17)).toEqual([0, 1, 2]);
  });

  it("treats a start above the scroll origin as the first tick", () => {
    expect(placeSectionTicks([-0.4, 0.5], 17)).toEqual([0, 8]);
  });
});

describe("nearestSection", () => {
  it("snaps a raw progress to the closest section", () => {
    expect(nearestSection([0, 0.25, 0.5, 0.75], 0.58)).toBe(2);
    expect(nearestSection([0, 0.25, 0.5, 0.75], 0.12)).toBe(0);
    expect(nearestSection([], 0.4)).toBe(-1);
  });
});

describe("clamp01", () => {
  it("keeps progress inside the track", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.32)).toBe(0.32);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});
