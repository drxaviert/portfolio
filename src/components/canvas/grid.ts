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
