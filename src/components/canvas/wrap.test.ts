import { describe, expect, it } from "vitest";
import { gridLayout, masonryLayout, scatterLayout } from "./layouts";
import type { CanvasLayout, LayoutItem, LayoutRect } from "./layouts";
import { mod, nearestPeriodic, planePosition, wrapCoordinate } from "./wrap";

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

describe("per-plane wrap", () => {
  const halfPeriod = 1458;

  it("folds a coordinate into the centred range", () => {
    expect(wrapCoordinate(0, halfPeriod)).toBe(0);
    expect(wrapCoordinate(halfPeriod - 0.001, halfPeriod)).toBeCloseTo(
      halfPeriod - 0.001,
      6,
    );
    expect(wrapCoordinate(halfPeriod + 0.001, halfPeriod)).toBeCloseTo(
      -halfPeriod + 0.001,
      6,
    );
    expect(wrapCoordinate(-halfPeriod, halfPeriod)).toBe(-halfPeriod);
  });

  it("jumps exactly one period at the seam", () => {
    const before = wrapCoordinate(halfPeriod - 0.001, halfPeriod);
    const after = wrapCoordinate(halfPeriod + 0.001, halfPeriod);

    expect(after - before).toBeCloseTo(-halfPeriod * 2 + 0.002, 6);
  });

  it("never pops inside the viewport at the seam", () => {
    // 1440x900 viewport, 300x300 plane, the real grid's half-period.
    const viewportHalf = 720;
    const planeHalf = 150;

    for (const seam of [-halfPeriod, halfPeriod]) {
      const centre = wrapCoordinate(seam, halfPeriod);

      expect(Math.abs(centre) - planeHalf).toBeGreaterThan(viewportHalf);
    }

    // Just before the seam the plane is already entirely off screen too, so
    // the fold is invisible, not a pop.
    const before = planePosition(0, halfPeriod - 0.5, halfPeriod);

    expect(Math.abs(before) - planeHalf).toBeGreaterThan(viewportHalf);
  });

  it("adds the scroll offset until the fold", () => {
    expect(planePosition(100, 200, halfPeriod)).toBe(300);
    expect(planePosition(100, -250, halfPeriod)).toBe(-150);
  });

  it("picks the nearest period when centring a plane", () => {
    expect(nearestPeriodic(100, 1500, 2916)).toBe(100);
    expect(nearestPeriodic(100, 2800, 2916)).toBe(3016);
    expect(nearestPeriodic(-100, -2800, 2916)).toBe(-3016);
  });
});

describe("legacy layouts", () => {
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
