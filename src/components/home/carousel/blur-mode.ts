/**
 * Dev comparison for how cards enter and leave the row (`?blur=`). Dat picks
 * one and this module (and its CSS block) goes away.
 *
 *   edge    an alpha mask on the row's card layer fades both ends while a step
 *           runs, and only the leaving and entering cards blur. Nothing paints
 *           a colour. Resting cards, rings and shadows are untouched.
 *   motion  cards blur slightly while they move: 0 at rest, peak mid-step
 *   none    nothing
 */
export type BlurMode = "edge" | "motion" | "none";

const MODES: readonly BlurMode[] = ["edge", "motion", "none"];

export function parseBlurMode(search: string): BlurMode {
  const value = new URLSearchParams(search).get("blur");
  return MODES.find((mode) => mode === value) ?? "edge";
}

export type BlurSettings = {
  /** Edge mask fade width, px. */
  edgeWidth: number;
  /** Blur of a leaving or entering card in edge mode, px. */
  edgeBlur: number;
  /** Peak blur of a moving card, px. */
  motionPeak: number;
};

export const DEFAULT_BLUR: BlurSettings = {
  edgeWidth: 28,
  edgeBlur: 2.5,
  motionPeak: 2.5,
};

export function blur(px: number): string {
  return px > 0.01 ? `blur(${px.toFixed(2)}px)` : "none";
}

/** A moving card's blur at eased progress p: rises to the peak at 0.5, then 0. */
export function motionBlurAt(peak: number, p: number): number {
  return p < 0.5 ? peak * (p / 0.5) : peak * (1 - (p - 0.5) / 0.5);
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
