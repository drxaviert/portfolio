import { describe, expect, it } from "vitest";
import {
  blockSpan,
  clamp01,
  collapseText,
  nearestSection,
  pickBlock,
  placeSectionTicks,
  RULER_MIN_TICKS,
  rulerTickCount,
  slugifyHeading,
  tickAt,
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

describe("tickAt", () => {
  it("snaps a pointer height to the nearest tick, with no dead gaps", () => {
    // 17 ticks, so rows are 1/16 apart: every step of the column lands on one.
    expect(tickAt(0, 17)).toBe(0);
    expect(tickAt(0.03, 17)).toBe(0);
    expect(tickAt(0.04, 17)).toBe(1);
    expect(tickAt(0.5, 17)).toBe(8);
    expect(tickAt(0.53, 17)).toBe(8);
    expect(tickAt(0.94, 17)).toBe(15);
    expect(tickAt(1, 17)).toBe(16);
  });

  it("clamps above and below the column, and has no tick without a grid", () => {
    expect(tickAt(-0.5, 17)).toBe(0);
    expect(tickAt(1.5, 17)).toBe(16);
    expect(tickAt(0.4, 0)).toBe(-1);
  });
});

describe("pickBlock", () => {
  const spans = [
    { top: 0, bottom: 120 },
    { top: 180, bottom: 400 },
    { top: 400, bottom: 520 },
  ];

  it("picks the block that covers the position", () => {
    expect(pickBlock(spans, 0)).toBe(0);
    expect(pickBlock(spans, 119)).toBe(0);
    expect(pickBlock(spans, 200)).toBe(1);
    expect(pickBlock(spans, 420)).toBe(2);
  });

  it("picks the nearest block in the gap between two of them", () => {
    expect(pickBlock(spans, 130)).toBe(0);
    expect(pickBlock(spans, 170)).toBe(1);
  });

  it("picks the first block above the article and the last below it", () => {
    expect(pickBlock(spans, -400)).toBe(0);
    expect(pickBlock(spans, 4000)).toBe(2);
    expect(pickBlock([], 120)).toBe(-1);
  });
});

describe("blockSpan", () => {
  it("moves the whole block, not just its top", () => {
    expect(blockSpan(696, 101, 124)).toEqual({ top: 572, bottom: 673 });
  });

  it("keeps a block from claiming the start of the one after it", () => {
    // A real study, in content offsets, with the reader's 124px landing
    // clearance. Without the shift on the bottom, the 696 paragraph would run
    // to 797 and swallow the 872 one at tick 7's 793.
    const spans = [
      blockSpan(591, 20, 124),
      blockSpan(621, 61, 124),
      blockSpan(696, 101, 124),
      blockSpan(842, 20, 124),
      blockSpan(872, 41, 124),
      blockSpan(926, 81, 124),
    ];

    expect(pickBlock(spans, 793)).toBe(4);
    expect(pickBlock(spans, 680)).toBe(2);
    expect(pickBlock(spans, 906)).toBe(5);
  });
});

describe("collapseText", () => {
  it("makes one line out of wrapped markup", () => {
    expect(
      collapseText("  The motion rule took\n  the same shape.\tAnd kept it.  "),
    ).toBe("The motion rule took the same shape. And kept it.");
  });

  it("returns an empty string for whitespace only", () => {
    expect(collapseText("\n \t ")).toBe("");
  });
});
