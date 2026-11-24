/**
 * Per-plane wrapping for the WebGL canvas.
 *
 * The grid is centred on the origin and spans `2 * halfPeriod` in each axis.
 * A plane position is `base + scroll`, folded into the centred range, so the
 * copy that leaves one edge arrives at the other one period away. If the grid
 * is larger than the viewport, that jump happens outside the visible area.
 */

/**
 * Positive modulo. `%` keeps the sign of the dividend, which turns a negative
 * value into a negative remainder and makes the fold jump.
 */
export function mod(value: number, length: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(length) || length === 0) {
    return 0;
  }

  return ((value % length) + length) % length;
}

/** Fold a coordinate into `[-halfPeriod, halfPeriod)`. */
export function wrapCoordinate(value: number, halfPeriod: number): number {
  if (!Number.isFinite(halfPeriod) || halfPeriod <= 0) return value;

  return mod(value + halfPeriod, halfPeriod * 2) - halfPeriod;
}

/** A plane centre on screen: its base position plus the shared scroll offset. */
export function planePosition(
  base: number,
  scroll: number,
  halfPeriod: number,
): number {
  return wrapCoordinate(base + scroll, halfPeriod);
}

/**
 * The equivalent of `target` nearest to `current`, one or more periods away.
 * Arrow navigation uses this so centring a neighbouring plane never sends the
 * scroll offset the long way round the torus.
 */
export function nearestPeriodic(
  target: number,
  current: number,
  period: number,
): number {
  if (!Number.isFinite(period) || period <= 0) return target;

  return target + Math.round((current - target) / period) * period;
}
