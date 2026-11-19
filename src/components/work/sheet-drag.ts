/**
 * The drag-to-dismiss numbers, kept out of the component so they can be read
 * and tested on their own.
 */

/** Past this share of the sheet's height, a release dismisses it. */
export const DISMISS_RATIO = 0.25;

/** ... or this downward speed at release, in px/s. */
export const DISMISS_VELOCITY = 500;

/** The last stretch of a gesture that sets the release velocity. */
const VELOCITY_WINDOW_MS = 100;

/** How much of the travel past a bound the sheet takes (rubber band). */
const PAST_BOUND = 0.15;

/** A release faster than this is a fling, not a drag. */
const MAX_VELOCITY = 6000;

export type Sample = { y: number; t: number };

/**
 * The sheet's offset for a pointer that has moved `dy` from where the drag
 * began. 1:1 inside its travel: up to `height` (the closed position) downward,
 * and no higher than the open position at 0. Past either bound it gives way,
 * so a drag cannot pull the sheet off its track and the bottom bound reads as
 * rubber instead of a wall.
 */
export function dragOffset(dy: number, height: number): number {
  if (dy < 0) return dy * PAST_BOUND;

  if (dy > height) return height + (dy - height) * PAST_BOUND;

  return dy;
}

/** Whether a release at `offset` and `velocity` dismisses the sheet. */
export function shouldDismiss(
  offset: number,
  velocity: number,
  height: number,
): boolean {
  return offset > height * DISMISS_RATIO || velocity > DISMISS_VELOCITY;
}

/**
 * The downward speed of the release, in px/s, from the last 100ms of the
 * gesture. Only the tail counts: a drag that stalled before letting go is a
 * placement, not a flick.
 */
export function releaseVelocity(samples: readonly Sample[]): number {
  if (samples.length < 2) return 0;

  const last = samples[samples.length - 1];
  const cutoff = last.t - VELOCITY_WINDOW_MS;
  // Start at the release and walk back only as far as the window reaches: a
  // gesture that stalled before letting go has no speed to read.
  let first = last;

  for (let index = samples.length - 2; index >= 0; index -= 1) {
    if (samples[index].t < cutoff) break;
    first = samples[index];
  }

  const elapsed = last.t - first.t;
  if (elapsed <= 0) return 0;

  const velocity = ((last.y - first.y) / elapsed) * 1000;

  return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
}
