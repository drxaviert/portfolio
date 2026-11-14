/*
 * The nav's Glide capsule is two independent edges, each a damped spring.
 * A retarget only changes the target the spring is heading for, so the edge
 * keeps the position and the velocity it already has: the pill can be
 * redirected mid-flight the way a CSS transition can, instead of replaying a
 * flight from a stored start point.
 *
 * The step is the closed-form solution of the oscillator, not an integration
 * approximation, so splitting a frame into smaller frames lands on the same
 * place: the motion does not depend on the display's refresh rate.
 */

/** One capsule edge: a position on the run's x-axis and its velocity. */
export type GlideEdge = {
  position: number;
  velocity: number;
};

/**
 * A damped spring with unit mass. `stiffness` is the spring constant in 1/s²,
 * `dampingRatio` is 1 for critically damped and below 1 for a slight overshoot.
 */
export type GlideSpring = {
  stiffness: number;
  dampingRatio: number;
};

/**
 * The leading edge: stiff, near-critical (0.9) so it settles to sub-pixel in
 * about 185ms, matching the toggle's 180ms ease-out cubic.
 */
export const GLIDE_LEAD_SPRING: GlideSpring = {
  stiffness: 1100,
  dampingRatio: 0.9,
};

/**
 * The trailing edge: softer than the lead, near-critical (0.9), so it settles
 * in about 205ms once it starts moving. With the 100ms hold the runner gives a
 * move from rest, that lands at roughly 305ms, close to the toggle's 120ms lag
 * followed by a 220ms ease-out quint.
 */
export const GLIDE_TRAIL_SPRING: GlideSpring = {
  stiffness: 900,
  dampingRatio: 0.9,
};

/**
 * A frame longer than this is clamped. A backgrounded tab can hand rAF a gap
 * of seconds; the edges should continue, not teleport across the run.
 */
export const GLIDE_MAX_STEP_S = 1 / 30;

/** Sub-pixel: below this an edge is painted where it was already going. */
export const GLIDE_REST_PX = 0.4;

/** Slow enough that the remaining travel is invisible on the next frame. */
export const GLIDE_REST_VELOCITY = 12;

const NEAR_CRITICAL = 1e-3;

export function createEdge(position: number, velocity = 0): GlideEdge {
  return { position, velocity };
}

/**
 * True when the edge has arrived and stopped. The runner uses this to end the
 * rAF loop instead of leaving it spinning on an asymptote.
 */
export function isEdgeAtRest(edge: GlideEdge, target: number): boolean {
  return (
    Math.abs(edge.position - target) <= GLIDE_REST_PX &&
    Math.abs(edge.velocity) <= GLIDE_REST_VELOCITY
  );
}

/**
 * Steps an edge toward `target` by `dt` seconds and returns the new edge. The
 * old edge is left untouched, so a caller can keep the previous frame for a
 * trace or a comparison.
 */
export function stepEdge(
  edge: GlideEdge,
  target: number,
  dt: number,
  spring: GlideSpring,
): GlideEdge {
  const step = Math.min(Math.max(dt, 0), GLIDE_MAX_STEP_S);

  if (step === 0) {
    return { position: edge.position, velocity: edge.velocity };
  }

  const omega = Math.sqrt(spring.stiffness);
  const zeta = spring.dampingRatio;

  // Displacement from the target: d'' + 2*zeta*omega*d' + omega^2*d = 0.
  const d0 = edge.position - target;
  const v0 = edge.velocity;

  if (Math.abs(zeta - 1) <= NEAR_CRITICAL) {
    const b = v0 + omega * d0;
    const decay = Math.exp(-omega * step);

    return {
      position: target + (d0 + b * step) * decay,
      velocity: (v0 - omega * b * step) * decay,
    };
  }

  if (zeta < 1) {
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega * step);
    const cos = Math.cos(omegaD * step);
    const sin = Math.sin(omegaD * step);

    return {
      position:
        target + decay * (d0 * cos + ((v0 + zeta * omega * d0) / omegaD) * sin),
      velocity:
        decay *
        (v0 * cos - ((zeta * omega * v0 + omega * omega * d0) / omegaD) * sin),
    };
  }

  const beta = omega * Math.sqrt(zeta * zeta - 1);
  const decay = Math.exp(-zeta * omega * step);

  return {
    position:
      target +
      decay *
        (d0 * Math.cosh(beta * step) +
          ((v0 + zeta * omega * d0) / beta) * Math.sinh(beta * step)),
    velocity:
      decay *
      (v0 * Math.cosh(beta * step) -
        ((zeta * omega * v0 + omega * omega * d0) / beta) *
          Math.sinh(beta * step)),
  };
}
