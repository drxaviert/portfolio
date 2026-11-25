import { describe, expect, it } from "vitest";
import {
  INTRO_GAP,
  LANDSCAPE_RATIO,
  PORTRAIT_RATIO,
  SQUARE_RATIO,
  centreOutCellOrder,
  gridMetrics,
  orientationRatio,
} from "./grid";
import { INTRO } from "./intro";

const introScale = INTRO.cameraFromZ / INTRO.cameraToZ;

/** The grid must clear the viewport at the intro's tightest, zoomed-out view. */
function seamClearance(
  grid: ReturnType<typeof gridMetrics>,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const centerX = (grid.cols * (grid.baseWidth + INTRO_GAP)) / 2;
  const centerY = (grid.rows * (grid.cellHeight + INTRO_GAP)) / 2;

  return {
    x: centerX - grid.baseWidth / 2 - (viewportWidth * introScale) / 2,
    y: centerY - grid.cellHeight / 2 - (viewportHeight * introScale) / 2,
  };
}

describe("gridMetrics", () => {
  it("matches the measured reference density at 1440x900", () => {
    const grid = gridMetrics(1440, 900);

    expect(grid.baseWidth).toBe(111);
    expect(grid.gap).toBe(127);
    expect(grid.cellHeight).toBe(148);
    expect(grid.pitchX).toBe(238);
    expect(grid.pitchY).toBe(275);
    // Counts cover the intro's packed grid and zoomed-out camera.
    expect(grid.cols).toBe(21);
    expect(grid.rows).toBe(13);
  });

  it("keeps the 1440x900 seam clear through the intro", () => {
    const grid = gridMetrics(1440, 900);
    const clearance = seamClearance(grid, 1440, 900);

    expect(clearance.x).toBeGreaterThan(0);
    expect(clearance.y).toBeGreaterThan(0);
    expect(grid.cols * (grid.baseWidth + INTRO_GAP)).toBeGreaterThan(
      1440 * introScale,
    );
    expect(grid.rows * (grid.cellHeight + INTRO_GAP)).toBeGreaterThan(
      900 * introScale,
    );
  });

  it("keeps the grid and seam clear of a 2560x1440 viewport", () => {
    const grid = gridMetrics(2560, 1440);
    const clearance = seamClearance(grid, 2560, 1440);

    expect(grid.baseWidth).toBe(197);
    expect(grid.gap).toBe(225);
    expect(grid.cols).toBe(22);
    expect(grid.rows).toBe(12);
    expect(grid.cols * grid.pitchX).toBeGreaterThan(2560);
    expect(grid.rows * grid.pitchY).toBeGreaterThan(1440);
    expect(clearance.x).toBeGreaterThan(0);
    expect(clearance.y).toBeGreaterThan(0);
  });

  it("scales a phone grid without losing the seam margin", () => {
    const grid = gridMetrics(390, 844);
    const clearance = seamClearance(grid, 390, 844);

    expect(grid.baseWidth).toBe(96);
    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(13);
    expect(clearance.x).toBeGreaterThan(0);
    expect(clearance.y).toBeGreaterThan(0);
  });
});

describe("orientationRatio", () => {
  it("uses the reference's three buckets", () => {
    expect(orientationRatio(0.75)).toBe(PORTRAIT_RATIO);
    expect(orientationRatio(1)).toBe(SQUARE_RATIO);
    expect(orientationRatio(1.78)).toBe(LANDSCAPE_RATIO);
  });
});

describe("centreOutCellOrder", () => {
  it("starts at the grid centre and lists every cell once", () => {
    const cols = 5;
    const rows = 5;
    const order = centreOutCellOrder(cols, rows);
    const distances = order.map((cell) => {
      const row = Math.floor(cell / cols);
      const col = cell % cols;

      return (col - (cols - 1) / 2) ** 2 + (row - (rows - 1) / 2) ** 2;
    });

    expect(order).toHaveLength(cols * rows);
    expect(new Set(order).size).toBe(cols * rows);
    expect(order[0]).toBe(12);
    for (let index = 1; index < distances.length; index += 1) {
      expect(distances[index]).toBeGreaterThanOrEqual(distances[index - 1]);
    }
  });
});
