import { describe, expect, it } from "vitest";
import {
  LANDSCAPE_RATIO,
  PORTRAIT_RATIO,
  SQUARE_RATIO,
  gridMetrics,
  orientationRatio,
} from "./grid";

describe("gridMetrics", () => {
  it("matches the measured reference density at 1440x900", () => {
    const grid = gridMetrics(1440, 900);

    expect(grid.baseWidth).toBe(111);
    expect(grid.gap).toBe(127);
    expect(grid.cellHeight).toBe(148);
    expect(grid.pitchX).toBe(238);
    expect(grid.pitchY).toBe(275);
    expect(grid.cols).toBe(11);
    expect(grid.rows).toBe(8);
  });

  it("keeps the 1440x900 seam outside the viewport", () => {
    const grid = gridMetrics(1440, 900);

    expect(grid.halfX - grid.baseWidth / 2).toBeGreaterThan(720);
    expect(grid.halfY - grid.cellHeight / 2).toBeGreaterThan(450);
  });

  it("keeps the grid and seam clear of a 2560x1440 viewport", () => {
    const grid = gridMetrics(2560, 1440);

    expect(grid.baseWidth).toBe(197);
    expect(grid.gap).toBe(225);
    expect(grid.cols).toBe(11);
    expect(grid.rows).toBe(7);
    expect(grid.cols * grid.pitchX).toBeGreaterThan(2560);
    expect(grid.rows * grid.pitchY).toBeGreaterThan(1440);
    expect(grid.halfX - grid.baseWidth / 2).toBeGreaterThan(1280);
    expect(grid.halfY - grid.cellHeight / 2).toBeGreaterThan(720);
  });

  it("scales a phone grid without losing the seam margin", () => {
    const grid = gridMetrics(390, 844);

    expect(grid.baseWidth).toBe(96);
    expect(grid.cols).toBe(6);
    expect(grid.rows).toBe(8);
    expect(grid.halfX - grid.baseWidth / 2).toBeGreaterThan(195);
    expect(grid.halfY - grid.cellHeight / 2).toBeGreaterThan(422);
  });
});

describe("orientationRatio", () => {
  it("uses the reference's three buckets", () => {
    expect(orientationRatio(0.75)).toBe(PORTRAIT_RATIO);
    expect(orientationRatio(1)).toBe(SQUARE_RATIO);
    expect(orientationRatio(1.78)).toBe(LANDSCAPE_RATIO);
  });
});
