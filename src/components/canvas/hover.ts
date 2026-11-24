import { power3InOut, power3Out } from "./intro";

/**
 * The pointer hover lift. One tween per plane, retargeted from its current
 * value so a fast pointer pass or an interrupted in/out never jumps. The
 * breathing scale multiplies on top; the hover never touches the phase.
 */

export type HoverSettings = {
  /** Absolute scale at full hover, e.g. 1.08. */
  scale: number;
};

export type HoverTween = {
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
};

export const HOVER = {
  defaultScale: 1.08,
  minScale: 1,
  maxScale: 1.2,
  /** Ease-out for the lift. */
  inMs: 280,
  /** Ease-in-out for the return. */
  outMs: 400,
} as const;

export function hoverValue(tween: HoverTween, now: number): number {
  if (tween.durationMs <= 0) return tween.to;

  const t = Math.min(
    1,
    Math.max(0, (now - tween.startedAt) / tween.durationMs),
  );
  const eased = tween.to >= tween.from ? power3Out(t) : power3InOut(t);

  return tween.from + (tween.to - tween.from) * eased;
}

/** Start a new tween at the value the old one reached, so there is no jump. */
export function retargetHover(
  tween: HoverTween,
  to: number,
  now: number,
): HoverTween {
  const from = hoverValue(tween, now);

  if (Math.abs(to - from) < 0.0001) {
    return { from: to, to, startedAt: now, durationMs: 0 };
  }

  return {
    from,
    to,
    startedAt: now,
    durationMs: to > from ? HOVER.inMs : HOVER.outMs,
  };
}
