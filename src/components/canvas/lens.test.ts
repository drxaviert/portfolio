import { describe, expect, it } from "vitest";
import {
  LENS,
  lensProject,
  lensRadius,
  lensTargetStrength,
  lensUnproject,
  smoothstep01,
} from "./lens";

const ASPECT = 1440 / 900;
const WIDE_ASPECT = 2560 / 1440;

describe("lens map", () => {
  it("locks the owner's tuned globe defaults", () => {
    expect(LENS.defaultMode).toBe("globe");
    expect(LENS.defaultStrength).toBe(0.23);
    expect(LENS.defaultBoost).toBe(0.3);
    expect(LENS.defaultVignette).toBe(0.25);
  });

  it("keeps the source margin and source scale in sync", () => {
    expect(LENS.sourceScale).toBeCloseTo(1 / (1 + 2 * LENS.margin), 12);
  });

  it("keeps the centre identical", () => {
    expect(lensProject(0, 0, LENS.defaultStrength, ASPECT)).toEqual({
      x: 0,
      y: 0,
    });
    expect(lensUnproject(0, 0, LENS.defaultStrength, ASPECT)).toEqual({
      x: 0,
      y: 0,
    });
    expect(lensRadius(0, 0, ASPECT)).toBe(0);
  });

  it("maps the flat view through sourceScale only", () => {
    const point = lensProject(0.5, -0.25, 0, ASPECT);

    expect(point.x).toBeCloseTo(0.5 * LENS.sourceScale, 12);
    expect(point.y).toBeCloseTo(-0.25 * LENS.sourceScale, 12);
  });

  it("keeps every source inside the target margin at max strength", () => {
    for (const x of [-1, -0.5, 0, 0.5, 1]) {
      for (const y of [-1, -0.5, 0, 0.5, 1]) {
        const source = lensProject(x, y, LENS.maxStrength, ASPECT);
        expect(Math.abs(source.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(source.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("round-trips every viewport sample within 0.5px", () => {
    for (const [aspect, viewportWidth, viewportHeight] of [
      [ASPECT, 1440, 900],
      [WIDE_ASPECT, 2560, 1440],
    ] as const) {
      for (const strength of [0.2, 0.32, 0.5]) {
        for (let x = -1; x <= 1.0001; x += 0.2) {
          for (let y = -1; y <= 1.0001; y += 0.2) {
            const source = lensProject(x, y, strength, aspect);
            const back = lensUnproject(source.x, source.y, strength, aspect);
            const errorX = Math.abs(back.x - x) * (viewportWidth / 2);
            const errorY = Math.abs(back.y - y) * (viewportHeight / 2);

            expect(errorX).toBeLessThan(0.5);
            expect(errorY).toBeLessThan(0.5);
          }
        }
      }
    }
  });

  it("is monotonic and compresses more toward the edge", () => {
    let previous = 0;
    for (let i = 0; i <= 20; i += 1) {
      const r = i / 20;
      const source = Math.abs(lensProject(r, 0, 0.3, ASPECT).x);
      expect(source).toBeGreaterThanOrEqual(previous);
      previous = source;
    }

    const centreSlope = Math.abs(lensProject(0.01, 0, 0.3, ASPECT).x) / 0.01;
    const edgeSlope =
      (Math.abs(lensProject(1, 0, 0.3, ASPECT).x) -
        Math.abs(lensProject(0.99, 0, 0.3, ASPECT).x)) /
      0.01;
    expect(edgeSlope).toBeGreaterThan(centreSlope);
  });
});

describe("lens strength", () => {
  it("is zero in flat mode", () => {
    expect(
      lensTargetStrength({
        mode: "flat",
        base: LENS.defaultStrength,
        boost: LENS.defaultBoost,
        speed: 8,
        reduced: false,
      }),
    ).toBe(0);
  });

  it("adds the boost at a fast drag and clamps the total", () => {
    expect(
      lensTargetStrength({
        mode: "globe",
        base: 0.2,
        boost: 0.12,
        speed: 0,
        reduced: false,
      }),
    ).toBeCloseTo(0.2, 6);
    expect(
      lensTargetStrength({
        mode: "globe",
        base: 0.2,
        boost: 0.12,
        speed: LENS.boostSpeed,
        reduced: false,
      }),
    ).toBeCloseTo(0.32, 6);
    expect(
      lensTargetStrength({
        mode: "globe",
        base: LENS.defaultStrength,
        boost: LENS.defaultBoost,
        speed: LENS.boostSpeed,
        reduced: false,
      }),
    ).toBe(LENS.maxStrength);
    expect(
      lensTargetStrength({
        mode: "globe",
        base: 0.5,
        boost: 0.3,
        speed: LENS.boostSpeed,
        reduced: false,
      }),
    ).toBe(LENS.maxStrength);
  });

  it("uses the constant base under reduced motion", () => {
    expect(
      lensTargetStrength({
        mode: "globe",
        base: 0.2,
        boost: 0.12,
        speed: 50,
        reduced: true,
      }),
    ).toBe(0.2);
  });

  it("smoothsteps 0..1", () => {
    expect(smoothstep01(0)).toBe(0);
    expect(smoothstep01(0.5)).toBe(0.5);
    expect(smoothstep01(1)).toBe(1);
  });
});
