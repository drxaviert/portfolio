/**
 * Pure pan kinematics shared by the hook and its tests.
 *
 * `stepGlide` is the reference's per-frame model applied at an arbitrary frame
 * interval: a velocity decays by `decay^dt` and moves by the geometric sum of
 * the 60fps steps inside `dt`. At 60fps that is exactly `position += velocity`,
 * `velocity *= decay`; at 30/120fps it preserves the same total travel.
 */

export type Velocity = {
  x: number;
  y: number;
};

export type Direction = {
  x: number;
  y: number;
};

export type GlideState = {
  position: number;
  velocity: number;
};

/** The share of a velocity that one frame adds to position. */
export function glideStepFactor(decay: number, dtFrames: number): number {
  if (decay === 1) return dtFrames;

  return (1 - Math.pow(decay, dtFrames)) / (1 - decay);
}

/** The velocity multiplier after `dtFrames` 60fps-frame units. */
export function decayFactor(decay: number, dtFrames: number): number {
  return Math.pow(decay, dtFrames);
}

/** One scalar glide step, used by the integrator test. */
export function stepGlide(
  state: GlideState,
  decay: number,
  dtFrames: number,
): GlideState {
  return {
    position:
      state.position + state.velocity * glideStepFactor(decay, dtFrames),
    velocity: state.velocity * decayFactor(decay, dtFrames),
  };
}

/** Total distance a released velocity travels before the decay is negligible. */
export function glideDistance(velocity: number, decay: number): number {
  if (decay >= 1) return Number.POSITIVE_INFINITY;

  return velocity / (1 - decay);
}

/** A unit vector, or zero for no input. */
export function normalizeDirection(x: number, y: number): Direction {
  const length = Math.hypot(x, y);

  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

/**
 * The combined arrow-key direction, normalized so diagonals are not faster.
 *
 * Arrow keys nudge the content, not the camera, so the scroll input is the
 * inverse of the key: ArrowRight moves the content right (scroll x decreases).
 */
export function arrowDirection(keys: ReadonlySet<string>): Direction {
  let x = 0;
  let y = 0;

  if (keys.has("ArrowLeft")) x += 1;
  if (keys.has("ArrowRight")) x -= 1;
  if (keys.has("ArrowUp")) y += 1;
  if (keys.has("ArrowDown")) y -= 1;

  return normalizeDirection(x, y);
}
