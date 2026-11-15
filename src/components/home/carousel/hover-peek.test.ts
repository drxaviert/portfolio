import { describe, expect, it } from "vitest";
import { inZone, movedItems, onPrev, peekItem, peekLayout } from "./hover-peek";
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

  it("covers the gutter and the first 40px of the column at rest", () => {
    expect(inZone(0, 200, row, 40)).toBe(true);
    expect(inZone(139, 200, row, 40)).toBe(true);
    expect(inZone(141, 200, row, 40)).toBe(false);
  });

  it("grows to cover the previous card and its gap while open", () => {
    // The previous card is 84px wide and the featured card starts at 96.
    expect(inZone(100 + 83, 200, row, 96)).toBe(true);
    expect(inZone(100 + 95, 200, row, 96)).toBe(true);
    expect(inZone(100 + 97, 200, row, 96)).toBe(false);
  });

  it("does not reach the right edge and is limited to the row's height", () => {
    expect(inZone(1090, 200, row, 40)).toBe(false);
    expect(inZone(110, 20, row, 40)).toBe(false);
    expect(inZone(110, 500, row, 40)).toBe(false);
  });

  it("finds the previous card", () => {
    expect(onPrev(110, 200, row, 84)).toBe(true);
    expect(onPrev(90, 200, row, 84)).toBe(false);
    expect(onPrev(100 + 90, 200, row, 84)).toBe(false);
  });
});

describe("open geometry at xl (n = 4 and n = 6 alike)", () => {
  const l = peekLayout(G);

  it("shifts by the last slot's width plus a gap", () => {
    expect(l.shift).toBe(96);
    expect(l.prevW).toBe(84);
  });

  it("reads [prev 84][12][featured 753][12][180][12][83] across the column", () => {
    const [a, b, c, d] = l.cardX;

    expect(l.prev.toX).toBe(0);
    expect(a - (l.prev.toX + l.prevW)).toBe(12);
    expect(a).toBe(96);
    expect(b - (a + 753)).toBe(12);
    expect(c - (b + 180)).toBe(12);
    expect(c + 83).toBe(G.rowWidth);
    // The last card is out past the column's right edge.
    expect(d).toBeGreaterThanOrEqual(G.rowWidth);
  });

  it("brings the previous card in from beyond the left edge", () => {
    expect(l.prev.fromX + l.prevW).toBeLessThan(0);
  });

  it("scales with the breakpoint: lg slots (656/140/64/64)", () => {
    const lg: Geometry = {
      slots: [
        { x: 0, w: 656 },
        { x: 668, w: 140 },
        { x: 820, w: 64 },
        { x: 896, w: 64 },
      ],
      rowWidth: 960,
      gap: 12,
    };
    const open = peekLayout(lg);

    expect(open.shift).toBe(76);
    expect(open.cardX[2] + 64).toBe(960);
  });
});
