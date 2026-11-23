/**
 * Pure pan kinematics shared by the hook and its tests.
 *
 * Samples are in viewport CSS px; time is `performance.now()` milliseconds.
 * Release velocity is px/ms. The hook converts it to its scroll units (px per
 * 60fps frame) before applying the glide.
 */

export type PointerSample = {
  t: number;
  x: number;
  y: number;
};

export type Velocity = {
  x: number;
  y: number;
};

export type Direction = {
  x: number;
  y: number;
};

export type ReleaseSampleOptions = {
  /** The trailing window the release estimate covers. */
  windowMs: number;
  /** A release after this much quiet time gets no fling. */
  staleMs: number;
  /** Two positions closer than this cannot make a stable estimate. */
  minGapMs: number;
};

export type ReleaseGainOptions = {
  minGain: number;
  maxGain: number;
  slowPxPerMs: number;
  fastPxPerMs: number;
  touchScale: number;
};

/**
 * Average the pointer's last window of movement.
 *
 * The last sample must be recent, so a deliberate pause before lifting does
 * not turn into a glide. If the window collapsed to one event (a slow event
 * rate), the previous sample is used when it is close enough; otherwise the
 * gesture has no reliable release velocity.
 */
export function estimateReleaseVelocity(
  samples: readonly PointerSample[],
  now: number,
  options: ReleaseSampleOptions,
): Velocity | null {
  if (samples.length < 2) return null;

  const latest = samples[samples.length - 1];

  if (now - latest.t > options.staleMs) return null;

  const cutoff = now - options.windowMs;
  let start = samples.length - 1;

  while (start > 0 && samples[start - 1].t >= cutoff) {
    start -= 1;
  }

  let first = samples[start];
  let gap = latest.t - first.t;

  if (gap < options.minGapMs && start > 0) {
    first = samples[start - 1];
    gap = latest.t - first.t;
  }

  if (gap < options.minGapMs) return null;

  // Only one sample was inside the window; allow the previous one as a
  // low-event-rate fallback, but not an arbitrarily old gesture.
  if (start === samples.length - 1 && gap > options.windowMs * 1.5) {
    return null;
  }

  return {
    x: (latest.x - first.x) / gap,
    y: (latest.y - first.y) / gap,
  };
}

/**
 * Speed-sensitive release gain. A gentle release keeps the reference's
 * restrained glide; a hard flick ramps toward the larger gain that makes the
 * canvas coast. Linear speed would make slow releases travel too far.
 */
export function releaseGain(
  speedPxPerMs: number,
  touch: boolean,
  options: ReleaseGainOptions,
): number {
  const span = Math.max(0.0001, options.fastPxPerMs - options.slowPxPerMs);
  const t = Math.min(
    1,
    Math.max(0, (speedPxPerMs - options.slowPxPerMs) / span),
  );
  const eased = t * t * (3 - 2 * t);
  const gain = options.minGain + (options.maxGain - options.minGain) * eased;

  return touch ? gain * options.touchScale : gain;
}

/** A unit vector, or zero for no input. */
export function normalizeDirection(x: number, y: number): Direction {
  const length = Math.hypot(x, y);

  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

/** The combined arrow-key direction, normalized so diagonals are not faster. */
export function arrowDirection(keys: ReadonlySet<string>): Direction {
  let x = 0;
  let y = 0;

  if (keys.has("ArrowLeft")) x -= 1;
  if (keys.has("ArrowRight")) x += 1;
  if (keys.has("ArrowUp")) y -= 1;
  if (keys.has("ArrowDown")) y += 1;

  return normalizeDirection(x, y);
}
