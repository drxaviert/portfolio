/**
 * The row's edge treatment (no modes left to compare).
 *
 *   edge    an alpha mask on the row's card layer fades both ends while a step
 *           runs, and only the leaving and entering cards blur. Nothing paints
 *           a colour. Resting cards, rings and shadows are untouched.
 */
export type BlurSettings = {
  /** Edge mask fade width, px. */
  edgeWidth: number;
  /** Blur of a leaving or entering card, px. */
  edgeBlur: number;
};

export const DEFAULT_BLUR: BlurSettings = {
  edgeWidth: 28,
  edgeBlur: 2.5,
};

export function blur(px: number): string {
  return px > 0.01 ? `blur(${px.toFixed(2)}px)` : "none";
}

/**
 * The edge mask's strength over a run's time: eases in, holds, eases out, so
 * the mask never switches on or off. Used by steps and by the hover peek.
 */
export const EDGE_KEYFRAMES: {
  offset: number;
  fade: number;
  easing?: string;
}[] = [
  { offset: 0, fade: 0, easing: "ease-in-out" },
  { offset: 0.35, fade: 1, easing: "linear" },
  { offset: 0.65, fade: 1, easing: "ease-in-out" },
  { offset: 1, fade: 0 },
];
