/** A viewport-space rectangle. Everything the morph measures is one of these. */
export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Flip = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

/**
 * The one flight the panel and the nav dock share: the curve and the two
 * durations live here so a retune moves both, never one of them.
 */
export const MORPH_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
export const MORPH_OPEN_S = 0.48;
export const MORPH_CLOSE_S = 0.3;

/**
 * The card-less close has no card to land on, so the panel leaves in place:
 * it scales down about what the reader is looking at, on the close flight.
 */
export const CLOSE_SCALE = 0.95;

/**
 * The centre of the part of `rect` that is actually on screen, in the
 * element's own coordinates — a transform origin for an exit that must shrink
 * in place, not from the top of a panel taller than the viewport.
 */
export function visibleCentre(
  rect: DOMRect,
  viewport: { width: number; height: number },
): string {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, viewport.width);
  const bottom = Math.min(rect.bottom, viewport.height);

  if (right <= left || bottom <= top) return "50% 50%";

  return `${Math.round((left + right) / 2 - rect.left)}px ${Math.round(
    (top + bottom) / 2 - rect.top,
  )}px`;
}

/**
 * The transform that puts the `to` box exactly over the `from` box, with the
 * origin at the top-left corner. The panel keeps its final layout box the whole
 * time, so only `transform` ever animates.
 */
export function flipFrom(from: Box, to: Box): Flip {
  return {
    x: from.left - to.left,
    y: from.top - to.top,
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
  };
}

/** A box in viewport space, from a live element rect. */
export function toBox(rect: DOMRect): Box {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * A flight promise that always settles within the flight's own duration. A
 * paused or throttled frame loop — an occluded window, a background tab, low
 * power — must not be able to hold a route change hostage and leave the reader
 * transparent with no way back.
 */
export function landWithin(
  flight: Promise<unknown>,
  seconds: number,
): Promise<void> {
  return Promise.race([
    flight.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, seconds * 1000)),
  ]);
}
