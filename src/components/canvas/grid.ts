/**
 * The uniform plane grid's geometry. Pure so the seam guarantee can be tested:
 * the wrap boundary must sit outside the viewport plus half a plane.
 */

export const PLANE_WIDTH = 300;
export const GAP = 24;
export const SMALL_GAP = 16;
export const MAX_HEIGHT_RATIO = 0.75;
/** Extra cells past the viewport so the wrap seam stays off screen. */
export const EXTRA_COLS = 4;
export const EXTRA_ROWS = 4;

export type GridMetrics = {
  baseWidth: number;
  gap: number;
  cellHeight: number;
  pitchX: number;
  pitchY: number;
  cols: number;
  rows: number;
  halfX: number;
  halfY: number;
};

export function gridMetrics(
  viewportWidth: number,
  viewportHeight: number,
): GridMetrics {
  // Keep the reference's desktop scale, but let a phone show a few columns
  // instead of one oversized plane.
  const baseWidth =
    viewportWidth < 520
      ? Math.max(150, Math.round(viewportWidth * 0.42))
      : PLANE_WIDTH;
  const gap = viewportWidth < 520 ? SMALL_GAP : GAP;
  const cellHeight = baseWidth * MAX_HEIGHT_RATIO;
  const pitchX = baseWidth + gap;
  const pitchY = cellHeight + gap;
  const cols = Math.ceil(viewportWidth / pitchX) + EXTRA_COLS;
  const rows = Math.ceil(viewportHeight / pitchY) + EXTRA_ROWS;

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
