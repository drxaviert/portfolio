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
