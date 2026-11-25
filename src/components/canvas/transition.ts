/**
 * The click-to-open transition: a wrapped glide to the clicked plane, then a
 * grow to the focus rect, then a cross-fade to the DOM viewer.
 *
 * Mirrors the reference's animateToPlane: every plane glides for 1s with
 * power3.inOut while the other planes fade over .9s. The grow overlaps the
 * last 150ms of the glide, and the close is faster (0.8x the fade).
 *
 * The DOM viewer's FLIP uses the same power3.inOut shape as the canvas, not
 * easeOut, so the handoff changes speed continuously. The sibling reveal on
 * close is the same .9s curve the open uses, rather than a one-frame snap.
 */
import { clamp01, power3InOut } from "./intro";

/** power3.inOut as a bezier, for Motion's `ease` option. */
export const HANDOFF_BEZIER: [number, number, number, number] = [
  0.65, 0, 0.35, 1,
];

/** The same curve as a CSS timing function, for WAAPI and CSS. */
export const HANDOFF_EASE = `cubic-bezier(${HANDOFF_BEZIER.join(", ")})`;

export type TransitionPhase = "idle" | "opening" | "open" | "closing";
export type TransitionEvent = "open" | "opened" | "close" | "closed";

export const TRANSITION = {
  glideMs: 1000,
  fadeOutMs: 900,
  /** Grow starts 150ms before the glide ends. */
  growDelayMs: 850,
  growMs: 600,
  /** The canvas plane cross-fades with the DOM viewer at the grown size. */
  handoffMs: 200,
  captionDelayMs: 200,
  /** Close: caption/controls out, then the same 200ms handoff reversed. */
  closeCaptionMs: 150,
  closeCrossFadeMs: 200,
  /** The reverse grow: 600ms, same as the open. */
  closeShrinkMs: 600,
  /** A close that is interrupted and reopens: the shorter reverse flight. */
  reopenMs: 260,
  /** Other planes start fading in over the last 150ms of the shrink. */
  closeFadeDelayMs: 450,
  closeFadeMs: 900,
  /** 200ms cross-fade + 450ms delay + 900ms fade. */
  closeTotalMs: 1550,
  /** Wait for the viewer's decoded frame before starting the open handoff. */
  mediaReadyTimeoutMs: 250,
  reducedFadeMs: 200,
} as const;

export const FIT = {
  widthRatio: 0.88,
  heightRatio: 0.8,
} as const;

/** Fit a media ratio inside the viewer's allowance, keeping its aspect. */
export function fitBox(
  width: number,
  height: number,
  viewportW: number,
  viewportH: number,
): { width: number; height: number } {
  const scale = Math.min(
    (viewportW * FIT.widthRatio) / width,
    (viewportH * FIT.heightRatio) / height,
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The signed distance from one wrapped position to another, always the short
 * way round the seam. An exact half-period stays positive because either way
 * is the same length.
 */
export function shortestWrappedDelta(
  from: number,
  to: number,
  halfPeriod: number,
): number {
  if (!Number.isFinite(halfPeriod) || halfPeriod <= 0) return to - from;

  const period = halfPeriod * 2;
  let delta = (to - from) % period;

  if (delta > halfPeriod) delta -= period;
  if (delta < -halfPeriod) delta += period;

  return delta;
}

export function nextPhase(
  phase: TransitionPhase,
  event: TransitionEvent,
): TransitionPhase {
  switch (event) {
    case "open":
      return phase === "idle" ? "opening" : phase;
    case "opened":
      return phase === "opening" ? "open" : phase;
    case "close":
      return phase === "open" ? "closing" : phase;
    case "closed":
      return phase === "closing" ? "idle" : phase;
  }
}

export function canOpen(phase: TransitionPhase): boolean {
  return phase === "idle";
}

export function canClose(phase: TransitionPhase): boolean {
  return phase === "open";
}

export function glideProgress(elapsedMs: number): number {
  return power3InOut(clamp01(elapsedMs / TRANSITION.glideMs));
}

export function fadeOutProgress(elapsedMs: number): number {
  return power3InOut(clamp01(elapsedMs / TRANSITION.fadeOutMs));
}

export function growProgress(elapsedMs: number): number {
  return power3InOut(
    clamp01((elapsedMs - TRANSITION.growDelayMs) / TRANSITION.growMs),
  );
}

export function handoffProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / TRANSITION.handoffMs);
}

export function closeFadeProgress(elapsedMs: number): number {
  return power3InOut(
    clamp01(
      (elapsedMs - TRANSITION.closeCrossFadeMs - TRANSITION.closeFadeDelayMs) /
        TRANSITION.closeFadeMs,
    ),
  );
}

export function closeShrinkProgress(elapsedMs: number): number {
  return power3InOut(
    clamp01(
      (elapsedMs - TRANSITION.closeCrossFadeMs) / TRANSITION.closeShrinkMs,
    ),
  );
}

/**
 * The viewer-owned close lands when its 600ms reverse FLIP ends. The reference
 * starts the sibling fade 450ms after the crossfade begins, so the remaining
 * 50ms is the gap between the land and that beat.
 */
export function closeSiblingRevealDelayMs(): number {
  return Math.max(
    0,
    TRANSITION.closeCrossFadeMs +
      TRANSITION.closeFadeDelayMs -
      TRANSITION.closeShrinkMs,
  );
}

/** The .9s power3.inOut sibling fade that replaces the close's snap. */
export function closeSiblingRevealProgress(elapsedMs: number): number {
  return power3InOut(clamp01(elapsedMs / TRANSITION.closeFadeMs));
}

export function openComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.growDelayMs + TRANSITION.growMs;
}

export function closeComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.closeTotalMs;
}
