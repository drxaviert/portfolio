/**
 * The click-to-open transition: a wrapped glide to the clicked plane, then a
 * grow to the focus rect, then a cross-fade to the DOM viewer.
 *
 * Mirrors the reference's animateToPlane: every plane glides for 1s with
 * power3.inOut while the other planes fade over .9s. The grow overlaps the
 * last 150ms of the glide, and the close is faster (0.8x the fade).
 */
import { clamp01, power3InOut, power3Out } from "./intro";
import { nearestPeriodic } from "./wrap";

export type TransitionPhase = "idle" | "opening" | "open" | "closing";
export type TransitionEvent = "open" | "opened" | "close" | "closed";

/**
 * `power3InOut` above as a cubic-bezier, for CSS and View Transitions. The
 * canvas drives its timeline with the function; a route transition can only
 * hand CSS the equivalent curve, so keep the two in this one module.
 */
export const POWER3_IN_OUT_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

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
  /**
   * The lens returns with the shrink, not after it. Any delay here leaves the
   * landed tile static before the idle handoff, which reads as a freeze
   * followed by a snap. Sibling plane opacity is on its own, later clock
   * (`closeSiblingFadeDelayMs`): the grid is still hidden while the tile lands
   * and fills in behind it after.
   */
  closeFadeDelayMs: 0,
  closeFadeMs: 600,
  /**
   * The sibling planes stay hidden for the whole shrink. Their return starts
   * at 85% of the shrink (200ms hold + 0.85 * 600ms = 710ms), when the
   * featured tile is within 1.4% of its grid slot, and runs for 300ms. The
   * featured tile lands first at 800ms with only the first 10.8% of that fade
   * visible; the grid then fills in behind it until 1010ms.
   */
  closeSiblingFadeDelayMs: 710,
  closeSiblingFadeMs: 300,
  /**
   * The tile lands at 800ms, but the close is not finished until the sibling
   * fade tail ends at 1010ms. The viewer chrome waits for this, so the grid is
   * fully back when the close hands control back to idle.
   */
  closeTotalMs: 1010,
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

/**
 * The non-featured planes' return. They stay hidden until the featured tile
 * is nearly home, then fade in behind it; by the time this ends the tile has
 * already landed. The close's total includes this tail.
 */
export function closeSiblingFadeProgress(elapsedMs: number): number {
  return power3InOut(
    clamp01(
      (elapsedMs -
        TRANSITION.closeSiblingFadeDelayMs) /
        TRANSITION.closeSiblingFadeMs,
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
 * The reverse of the open's grid glide, on the plane shrink's timeline. The
 * open moves the canvas scroll from the clicked slot to the focus; the close
 * runs the same power3.inOut curve back to the pre-open scroll over the 600ms
 * shrink (after the 200ms cross-fade). Without this the plane can only shrink
 * in place while the grid reappears recentred, so the tile lands in a new slot
 * instead of gliding home.
 */
export function closeScrollOffset(
  fromScroll: number,
  focusScroll: number,
  elapsedMs: number,
): number {
  return (
    focusScroll +
    (fromScroll - focusScroll) * closeShrinkProgress(elapsedMs)
  );
}

/**
 * A resize rebuilds the grid, so the opened plane's base moves with the new
 * pitch. Retarget the open's scroll, pre-open home and focus target:
 *
 * - the focus lands on the new base (`-nextBase`), so the media stays centred;
 * - the pre-open offset (`from - to`) scales with the viewport, so the tile
 *   still returns to the same relative spot in the new layout instead of a
 *   pixel offset that can fall off screen.
 *
 * The current scroll shifts with the focus so the resize itself does not move
 * the opened plane. The new pitch also changes the wrap period: a target that
 * centred the plane under the old period can sit a whole period away from the
 * new centre. Pass `halfPeriod` to re-anchor the path on the periodic copy
 * nearest the pitch-shifted scroll. Without it the path keeps the plain
 * translation, which is all a caller without a wrap period needs. A held
 * open should then put its scroll on the returned `to`.
 */
export function resizeOpenScroll(
  scroll: number,
  from: number,
  to: number,
  previousBase: number,
  nextBase: number,
  scale: number,
  halfPeriod = 0,
): { scroll: number; from: number; to: number } {
  const delta = previousBase - nextBase;
  const home = (from - to) * scale;

  if (!Number.isFinite(halfPeriod) || halfPeriod <= 0) {
    const nextTo = to + delta;

    return {
      scroll: scroll + delta,
      from: nextTo + home,
      to: nextTo,
    };
  }

  const shifted = scroll + delta;
  const nextTo = nearestPeriodic(-nextBase, shifted, halfPeriod * 2);

  return {
    scroll: shifted,
    from: nextTo + home,
    to: nextTo,
  };
}

export function openComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.growDelayMs + TRANSITION.growMs;
}

export function closeComplete(elapsedMs: number): boolean {
  return elapsedMs >= TRANSITION.closeTotalMs;
}
