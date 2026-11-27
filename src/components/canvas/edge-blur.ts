/**
 * In-canvas progressive edge blur: tunables and the mask math shared with the
 * lens pass and edge composite.
 *
 * The lens pass renders into a screen-space target; a half-resolution
 * horizontal Gaussian feeds the vertical half in the final composite, and the
 * composite mixes that blurred copy back in by the eased screen-space mask. The
 * mask is a smoothstep of the normalized distance, mirrored exactly in
 * COMPOSITE_FRAGMENT_SHADER (infinite-canvas.tsx); keep the two in sync.
 *
 * This replaced the earlier CSS backdrop-filter overlay: the blur now lives in
 * the canvas's own render, so no extra compositor layers are created over the
 * WebGL surface.
 */

export const EDGE_BLUR = {
  /** Band depth: clamp(56px, 9vw, 160px), as the brief asks. */
  minDepthPx: 56,
  depthVw: 0.09,
  maxDepthPx: 160,
  /** The blurred radius at the very edge, in CSS px. */
  maxBlurPx: 16,
  /** The separable blur target's size relative to the screen target. */
  targetScale: 0.5,
  /** Faint theme-surface tint at the edge, under the blur. */
  tintStrength: 0.08,
  /** Tile-open/close dip, matching the CSS overlay's 200ms. */
  fadeMs: 200,
} as const;

/** The band depth for a viewport width, in CSS px. */
export function edgeBlurDepthPx(viewportWidth: number): number {
  const vw = viewportWidth * EDGE_BLUR.depthVw;

  return Math.min(EDGE_BLUR.maxDepthPx, Math.max(EDGE_BLUR.minDepthPx, vw));
}

/**
 * The edge radius in screen-target pixels. The screen target is at canvas
 * device resolution, so one CSS px is `dpr` pixels there.
 */
export function edgeBlurRadiusPx(maxBlurPx: number, dpr: number): number {
  if (dpr <= 0) return 0;

  return maxBlurPx * dpr;
}

/**
 * The edge mask at a UV: 1 at the very edge, 0 at the inner boundary, eased in
 * between. `depthX`/`depthY` are the band depth in UV units.
 */
export function edgeBlurMask(
  u: number,
  v: number,
  depthX: number,
  depthY: number,
): number {
  const dx = depthX > 0 ? Math.min(u, 1 - u) / depthX : 1;
  const dy = depthY > 0 ? Math.min(v, 1 - v) / depthY : 1;
  const t = Math.min(1, Math.max(0, Math.min(dx, dy)));
  const edge = 1 - t;

  return edge * edge * (3 - 2 * edge);
}
