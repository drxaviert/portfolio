import { describe, expect, it } from "vitest";
import {
  inZone,
  movedItems,
  onStrip,
  peekItem,
  peekLayout,
} from "./hover-peek";
import type { Geometry } from "./carousel-math";

const G: Geometry = {
  slots: [
    { x: 0, w: 594 },
    { x: 606, w: 170 },
    { x: 788, w: 100 },
    { x: 900, w: 100 },
  ],
  rowWidth: 1000,
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

describe("peek layout", () => {
  it("shifts every card by strip + gap and keeps the strip inside the column", () => {
    const l = peekLayout(G, 20, 12);

    expect(l.shift).toBe(32);
    expect(l.strip.toX).toBe(0);
    expect(l.strip.fromX).toBe(-20);
    // The first card's new left edge is exactly the gap past the strip.
    expect(G.slots[0].x + l.shift - (l.strip.toX + 20)).toBe(12);
  });
});
