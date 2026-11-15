import { describe, expect, it } from "vitest";
import {
  inZone,
  movedItems,
  onStrip,
  peekItem,
  peekLayout,
} from "./hover-peek";
import { fitWidths, parsePeekFit } from "./peek-fit";
import type { Geometry } from "./carousel-math";

// The xl row: 753 / 180 / 83 / 84 with 12px gaps, 1136 wide.
const G: Geometry = {
  slots: [
    { x: 0, w: 753 },
    { x: 765, w: 180 },
    { x: 957, w: 83 },
    { x: 1052, w: 84 },
  ],
  rowWidth: 1136,
  gap: 12,
};

describe("peek item", () => {
  it("is order[(first - 1 + n) % n]", () => {
    // n = 4: the last card; n = 6: the one before the first.
    expect(peekItem(4, 0)).toBe(3);
    expect(peekItem(4, 2)).toBe(1);
    expect(peekItem(6, 0)).toBe(5);
    expect(peekItem(6, 3)).toBe(2);
  });

  it("moves the four visible items, front to back", () => {
    expect(movedItems(6, 4)).toEqual([4, 5, 0, 1]);
    expect(movedItems(4, 1)).toEqual([1, 2, 3, 0]);
  });
});

describe("hover zone", () => {
  const row = { left: 100, right: 1100, top: 50, bottom: 466 };

  it("covers the gutter and the first 40px of the column", () => {
    expect(inZone(0, 200, row, 40)).toBe(true);
    expect(inZone(139, 200, row, 40)).toBe(true);
    expect(inZone(141, 200, row, 40)).toBe(false);
  });

  it("does not reach the right edge", () => {
    expect(inZone(1090, 200, row, 40)).toBe(false);
  });

  it("is limited to the row's height", () => {
    expect(inZone(110, 20, row, 40)).toBe(false);
    expect(inZone(110, 500, row, 40)).toBe(false);
  });

  it("finds the strip inside the column only", () => {
    expect(onStrip(110, 200, row, 20)).toBe(true);
    expect(onStrip(90, 200, row, 20)).toBe(false);
    expect(onStrip(130, 200, row, 20)).toBe(false);
  });
});

describe("peek fit", () => {
  it("defaults to featured", () => {
    expect(parsePeekFit("")).toBe("featured");
    expect(parsePeekFit("?peekFit=proportional")).toBe("proportional");
    expect(parsePeekFit("?peekFit=wide")).toBe("featured");
  });

  it("featured gives all the extra to the first card", () => {
    expect(fitWidths("featured", [753, 180, 83], 32)).toEqual([785, 180, 83]);
  });

  it("proportional shares the extra by rest width and keeps the total", () => {
    const w = fitWidths("proportional", [753, 180, 83], 32);

    expect(w[0] + w[1] + w[2]).toBeCloseTo(1048, 9);
    expect(w[0]).toBeCloseTo(753 + (32 * 753) / 1016, 9);
    expect(w[2] / w[0]).toBeCloseTo(83 / 753, 9);
  });
});

describe("peek layout at xl (n = 4, gap 12, W = 1136)", () => {
  for (const fit of ["featured", "proportional"] as const) {
    it(`${fit}: both end shapes are 20 and every gap is 12`, () => {
      const l = peekLayout(G, 20, 12, 4, fit);
      const [a, b, c, d] = l.cards;

      // Left shape: the strip, 0 to 20. Right shape: what shows of the last card.
      expect(l.strip.toX).toBe(0);
      expect(l.strip.box - l.strip.r).toBe(20);
      expect(G.rowWidth - d.x).toBe(20);

      expect(a.x - 20).toBe(12);
      expect(b.x - (a.x + a.w)).toBeCloseTo(12, 9);
      expect(c.x - (b.x + b.w)).toBeCloseTo(12, 9);
      expect(d.x - (c.x + c.w)).toBeCloseTo(12, 9);
    });
  }

  it("featured: A' = A + 32 and B, C keep their rest widths", () => {
    const [a, b, c, d] = peekLayout(G, 20, 12, 4, "featured").cards;

    expect(a.w).toBe(785);
    expect(b.w).toBe(180);
    expect(c.w).toBe(83);
    expect(d.w).toBe(84);
    expect([a.x, b.x, c.x, d.x]).toEqual([32, 829, 1021, 1116]);
    // Cropping less is enough: the box never has to be narrower than rest.
    expect(a.box).toBe(785);
    expect(b.box).toBe(180);
  });

  it("proportional: the three widths add up to the column minus both shapes and four gaps", () => {
    const [a, b, c] = peekLayout(G, 20, 12, 4, "proportional").cards;

    expect(a.w + b.w + c.w).toBeCloseTo(1136 - 88, 9);
  });
});
