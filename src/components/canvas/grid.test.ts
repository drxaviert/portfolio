import { describe, expect, it } from "vitest";
import { MAX_HEIGHT_RATIO, PLANE_WIDTH, gridMetrics } from "./grid";

describe("gridMetrics", () => {
  it("keeps the 1440x900 seam outside the viewport", () => {
    const grid = gridMetrics(1440, 900);

    expect(grid.cols).toBe(9);
    expect(grid.rows).toBe(8);
    expect(grid.halfX - PLANE_WIDTH / 2).toBeGreaterThan(720);
    expect(grid.halfY - (PLANE_WIDTH * MAX_HEIGHT_RATIO) / 2).toBeGreaterThan(
      450,
    );
  });

  it("keeps the grid and seam clear of a 2560x1440 viewport", () => {
    const grid = gridMetrics(2560, 1440);

    expect(grid.cols).toBe(12);
    expect(grid.rows).toBe(10);
    expect(grid.cols * grid.pitchX).toBeGreaterThan(2560);
    expect(grid.rows * grid.pitchY).toBeGreaterThan(1440);
    // The nearest plane edge to the wrap boundary is half a plane inside it.
    expect(grid.halfX - PLANE_WIDTH / 2).toBeGreaterThan(1280);
    expect(grid.halfY - (PLANE_WIDTH * MAX_HEIGHT_RATIO) / 2).toBeGreaterThan(
      720,
    );
  });

  it("scales a phone grid without losing the seam margin", () => {
    const grid = gridMetrics(390, 844);

    expect(grid.cols).toBe(7);
    expect(grid.rows).toBe(11);
    expect(grid.halfX - grid.baseWidth / 2).toBeGreaterThan(195);
    expect(grid.halfY - grid.cellHeight / 2).toBeGreaterThan(422);
  });
});
