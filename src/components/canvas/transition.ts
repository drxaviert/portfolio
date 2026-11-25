/**
 * The click-to-open transition: a wrapped glide to the clicked plane, then a
 * grow to the focus rect, then a cross-fade to the DOM viewer.
 *
 * Mirrors the reference's animateToPlane: every plane glides for 1s with
 * power3.inOut while the other planes fade over .9s. The grow overlaps the
 * last 150ms of the glide, and the close is faster (0.8x the fade).
 */
import { clamp01, power3InOut, power3Out } from "./intro";

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
  /** Other planes start fading in over the last 150ms of the shrink. */
  closeFadeDelayMs: 450,
  closeFadeMs: 900,
  /** 200ms cross-fade + 450ms delay + 900ms fade. */
  closeTotalMs: 1550,
  reducedFadeMs: 200,
} as const;

/** A tile can be the close target only when its whole rect is on screen. */
export function boxInsideViewport(
  box: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): boolean {
  return (
    box.left >= 0 &&
    box.top >= 0 &&
    box.left + box.width <= width &&
    box.top + box.height <= height
  );
}

/**
 * The viewer-owned open only animates the other planes' fade. Once that fade
 * has finished the scene is a held tile, so the rAF loop can idle until the
 * viewer hands over or the user closes.
 */
export function viewerOpenNeedsFrames(elapsedMs: number): boolean {
  return elapsedMs < TRANSITION.fadeOutMs;
}

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
 * The caption is centred in the gap between the focused frame and the
 * viewport bottom. A canvas-owned open knows both sizes up front, so the
 * reveal can place the caption without reading layout.
 */
export function captionTop(
  viewportHeight: number,
  frameHeight: number,
): number {
  return (viewportHeight * 3 + frameHeight) / 4;
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
  return power3Out(
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

export function openComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.growDelayMs + TRANSITION.growMs;
}

export function closeComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.closeTotalMs;
}
