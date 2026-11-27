import { INTRO } from "./intro";

/**
 * The reference gallery's measured spacing, ported to our viewport.
 *
 * At 1440x900 the reference's planes are 111px wide with a 127px gap:
 * width/viewport = 0.0771 and gap/width = 1.144. Rows reserve the portrait
 * ratio (1.33) plus the same gap, so square and landscape planes sit in a
 * taller cell and crop into their bucket ratio.
 */

export const PLANE_WIDTH_RATIO = 111 / 1440;
export const GAP_RATIO = 127 / 111;
export const PORTRAIT_RATIO = 1.33;
export const SQUARE_RATIO = 1;
export const LANDSCAPE_RATIO = 0.66;
/** A phone still needs a usable tap target. */
export const MIN_PLANE_WIDTH = 96;
/** The intro starts with this gap before spreading to the final spacing. */
export const INTRO_GAP = 8;
/** Extra cells past the viewport so the wrap seam stays off screen. */
export const EXTRA_COLS = 4;
export const EXTRA_ROWS = 4;

export type GridMetrics = {
  baseWidth: number;
  gap: number;
  /** The tallest orientation bucket (portrait); rows reserve this height. */
  cellHeight: number;
  pitchX: number;
  pitchY: number;
  cols: number;
  rows: number;
  halfX: number;
  halfY: number;
};

/** The reference's three shape buckets, chosen by media orientation. */
export function orientationRatio(aspect: number): number {
  if (aspect < 0.9) return PORTRAIT_RATIO;
  if (aspect > 1.1) return LANDSCAPE_RATIO;

  return SQUARE_RATIO;
}

/**
 * Cell indices ordered from the grid centre outward.
 *
 * The first items in `CANVAS_MEDIA` are the initial centre projects; this map
 * puts them in the cells closest to the viewport centre, then fills outward in
 * rings. The angle tie-break keeps the ring order deterministic.
 */
export function centreOutCellOrder(cols: number, rows: number): number[] {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const cells: {
    cell: number;
    distance: number;
    angle: number;
    row: number;
    col: number;
  }[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dx = col - cx;
      const dy = row - cy;

      cells.push({
        cell: row * cols + col,
        distance: dx * dx + dy * dy,
        angle: Math.atan2(dy, dx),
        row,
        col,
      });
    }
  }

  cells.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.angle - b.angle ||
      a.row - b.row ||
      a.col - b.col,
  );

  return cells.map((entry) => entry.cell);
}

export function gridMetrics(
  viewportWidth: number,
  viewportHeight: number,
): GridMetrics {
  const baseWidth = Math.max(
    MIN_PLANE_WIDTH,
    Math.round(viewportWidth * PLANE_WIDTH_RATIO),
  );
  const gap = Math.round(baseWidth * GAP_RATIO);
  const cellHeight = Math.round(baseWidth * PORTRAIT_RATIO);
  const pitchX = baseWidth + gap;
  const pitchY = cellHeight + gap;
  // The intro packs the grid at INTRO_GAP while the camera sits 200px back,
  // so the cell count must cover that wider, tightest view as well as the
  // final one.
  const introScale = INTRO.cameraFromZ / INTRO.cameraToZ;
  const cols =
    Math.ceil((viewportWidth * introScale) / (baseWidth + INTRO_GAP)) +
    EXTRA_COLS;
  const rows =
    Math.ceil((viewportHeight * introScale) / (cellHeight + INTRO_GAP)) +
    EXTRA_ROWS;

  return {
    baseWidth,
    gap,
    cellHeight,
    pitchX,
    pitchY,
    cols,
    rows,
    halfX: (cols * pitchX) / 2,
    halfY: (rows * pitchY) / 2,
  };
}
