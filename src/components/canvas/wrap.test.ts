import { describe, expect, it } from "vitest";
import { gridLayout, masonryLayout, scatterLayout } from "./layouts";
import type { CanvasLayout, LayoutItem, LayoutRect } from "./layouts";
import { mod, tileKey, visibleTiles } from "./wrap";
import type { WrapWorld } from "./wrap";

const ITEMS: LayoutItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: `tile-${index}`,
  w: index % 3 === 0 ? 2048 : 1600,
  h: index % 3 === 0 ? 1365 : 900,
}));

const LAYOUTS: { name: string; layout: CanvasLayout; gap: number }[] = [
  { name: "grid", layout: gridLayout(ITEMS), gap: 24 },
  { name: "masonry", layout: masonryLayout(ITEMS), gap: 24 },
  { name: "scatter", layout: scatterLayout(ITEMS), gap: 48 },
];

/** The gap-separated rectangle test used by the scatter placement. */
function apart(
  a: LayoutRect,
  b: LayoutRect,
  dx: number,
  dy: number,
  gap: number,
): boolean {
  const x = b.x + dx;
  const y = b.y + dy;

  return (
    a.x + a.w + gap <= x ||
    x + b.w + gap <= a.x ||
    a.y + a.h + gap <= y ||
    y + b.h + gap <= a.y
  );
}

describe("mod", () => {
  it("wraps negative values to a positive offset", () => {
    expect(mod(5, 3)).toBe(2);
    expect(mod(-5, 3)).toBe(1);
    expect(mod(-3, 3)).toBe(0);
    expect(mod(0, 3)).toBe(0);
  });

  it("is zero for a zero or non-finite period", () => {
    expect(mod(5, 0)).toBe(0);
    expect(mod(Number.NaN, 10)).toBe(0);
  });
});

describe("visibleTiles", () => {
  const world: WrapWorld = { worldW: 1000, worldH: 800 };

  it("keeps a tile continuous as it crosses the world seam", () => {
    const rects = [{ x: 0, y: 0, w: 100, h: 100 }];
    const viewport = { width: 300, height: 300 };
    const before = visibleTiles(
      rects,
      world,
      { x: 1000 - 0.001, y: 0 },
      viewport,
    );
    const after = visibleTiles(
      rects,
      world,
      { x: 1000 + 0.001, y: 0 },
      viewport,
    );

    // The tile leaves through the left edge as copy 1 and arrives from the
    // right edge as copy 1; there is no second jump when the index changes.
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(before[0].copyX).toBe(1);
    expect(after[0].copyX).toBe(1);
    expect(before[0].screenX).toBeCloseTo(0.001, 6);
    expect(after[0].screenX).toBeCloseTo(-0.001, 6);
    expect(Math.abs(after[0].screenX - before[0].screenX)).toBeLessThan(0.003);
  });

  it("shows the copies on both sides of the world at the edges", () => {
    const rects = [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 900, y: 0, w: 100, h: 100 },
    ];
    const tiles = visibleTiles(
      rects,
      world,
      { x: 850, y: 0 },
      { width: 400, height: 300 },
    );

    expect(tiles.map((tile) => tile.rectIndex).sort()).toEqual([0, 1]);
    expect(tiles.find((tile) => tile.rectIndex === 0)?.screenX).toBe(150);
    expect(tiles.find((tile) => tile.rectIndex === 1)?.screenX).toBe(50);
  });

  it("replicates a world smaller than the viewport in both axes", () => {
    const tiles = visibleTiles(
      [{ x: 0, y: 0, w: 50, h: 50 }],
      { worldW: 100, worldH: 100 },
      { x: 0, y: 0 },
      { width: 350, height: 350 },
    );

    expect(tiles).toHaveLength(16);
    expect(new Set(tiles.map((tile) => tile.screenX))).toEqual(
      new Set([0, 100, 200, 300]),
    );
    expect(new Set(tiles.map((tile) => tile.screenY))).toEqual(
      new Set([0, 100, 200, 300]),
    );
    expect(new Set(tiles.map(tileKey)).size).toBe(16);
  });

  it("mounts a tile through the margin before it is on screen", () => {
    const rects = [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 500, y: 0, w: 100, h: 100 },
    ];
    const withoutMargin = visibleTiles(
      rects,
      { worldW: 1000, worldH: 1000 },
      { x: 0, y: 0 },
      { width: 400, height: 400 },
    );
    const withMargin = visibleTiles(
      rects,
      { worldW: 1000, worldH: 1000 },
      { x: 0, y: 0 },
      { width: 400, height: 400 },
      200,
    );

    expect(withoutMargin).toHaveLength(1);
    expect(withMargin).toHaveLength(2);
    expect(withMargin.find((tile) => tile.rectIndex === 1)?.screenX).toBe(500);
  });

  it("returns nothing for a collapsed world or viewport", () => {
    expect(
      visibleTiles(
        [{ x: 0, y: 0, w: 10, h: 10 }],
        { worldW: 0, worldH: 10 },
        { x: 0, y: 0 },
        { width: 100, height: 100 },
      ),
    ).toEqual([]);
    expect(
      visibleTiles(
        [{ x: 0, y: 0, w: 10, h: 10 }],
        { worldW: 100, worldH: 100 },
        { x: 0, y: 0 },
        { width: 0, height: 100 },
      ),
    ).toEqual([]);
  });
});

describe("layouts", () => {
  it("creates a uniform 280px grid with a 24px seam gap", () => {
    const layout = gridLayout(ITEMS);

    expect(layout.worldW).toBe(4 * (280 + 24));
    expect(layout.worldH).toBe(3 * (280 + 24));
    expect(new Set(layout.rects.map((rect) => `${rect.w}x${rect.h}`))).toEqual(
      new Set(["280x280"]),
    );
    expect(layout.rects[1].x - layout.rects[0].x).toBe(304);
  });

  it("keeps masonry aspect ratios and the tallest column as the period", () => {
    const layout = masonryLayout(ITEMS);

    for (const rect of layout.rects) {
      const source = ITEMS[rect.index];

      expect(Math.abs(rect.w / rect.h - source.w / source.h)).toBeLessThan(
        0.01,
      );
    }

    const bottom = Math.max(...layout.rects.map((rect) => rect.y + rect.h));

    expect(layout.worldH).toBe(bottom + 24);
  });

  it("produces the same scatter world for the same seed", () => {
    const a = scatterLayout(ITEMS, { seed: 17 });
    const b = scatterLayout(ITEMS, { seed: 17 });
    const c = scatterLayout(ITEMS, { seed: 18 });

    expect(a).toEqual(b);
    expect(a.rects).not.toEqual(c.rects);
  });

  it("keeps every layout inside its world and gap-separated across the seam", () => {
    for (const { name, layout, gap } of LAYOUTS) {
      expect(layout.rects, name).toHaveLength(ITEMS.length);

      for (const rect of layout.rects) {
        expect(rect.x, name).toBeGreaterThanOrEqual(0);
        expect(rect.y, name).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w, name).toBeLessThanOrEqual(layout.worldW);
        expect(rect.y + rect.h, name).toBeLessThanOrEqual(layout.worldH);
      }

      for (let i = 0; i < layout.rects.length; i += 1) {
        for (let j = i + 1; j < layout.rects.length; j += 1) {
          for (const dx of [-layout.worldW, 0, layout.worldW]) {
            for (const dy of [-layout.worldH, 0, layout.worldH]) {
              expect(
                apart(layout.rects[i], layout.rects[j], dx, dy, gap),
                `${name}: rect ${i} and rect ${j} at ${dx},${dy}`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });
});
