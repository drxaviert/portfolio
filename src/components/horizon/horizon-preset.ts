import type {
  HorizonDither,
  HorizonGradientMode,
  HorizonListeningTuning,
  HorizonMotionTuning,
} from "./horizon-background";

/**
 * The one place the home page's horizon preset lives.
 *
 * These are the shipping values, tuned and then verified on the home page: a
 * slow-but-readable drift and breathe (a 30s loop across 15% x / 10% y), the
 * CSS dither grain for the fallback, and the shader's 1.5 LSB per-pixel dither
 * at a 1.5x device-pixel cap. The CSS layer and the WebGL layer both read this
 * object, so the fallback is the same picture, not an approximation of it.
 *
 * Strength and pulse are the picks from the tuning prototype: the glow sits at
 * 4x the Figma alpha by day (dawn and dusk share it) and 2.5x at night, with the
 * breathe adding up to 50% of that strength at the top of the breath, softened
 * to 70% of the swing while the Night phase is active. Both renderers apply the
 * same numbers, and reduced motion pins the pulse off.
 */
export const HORIZON_HOME_MOTION: Required<HorizonMotionTuning> = {
  driftPeriod: 30,
  driftTravelX: 15,
  driftTravelY: 10,
  breathePeriod: 6,
  breatheScale: 6,
  breatheDepth: 30,
  intensityAmp: 0.5,
  /** Night glows dimmer, so the pulse is softer there. */
  nightIntensityScale: 0.7,
  /** Strength peaks while the blob is tight and opaque. */
  intensityPeak: "core",
  /** Rest strength for day, dawn and dusk. */
  baseIntensity: 4,
  /** Rest strength at night. */
  nightBaseIntensity: 2.5,
};

/**
 * The listening swell: while "Door to the Cosmos" plays, the glow grows upward
 * and outward, softens, brightens and breathes slower and deeper.
 *
 * These are the effective shipping values at the tuning panel's default
 * Immersion of 1.5. The panel's per-parameter sliders store the base values at
 * Immersion 1; the master scales their deltas from the resting horizon, then
 * clamps them so the extreme end stays a glow instead of clipping to a flat
 * white shape. "Copy values" in the panel writes these effective values back in
 * this shape.
 *
 * The shader runs these on its own rAF clock with an asymmetric ramp: a long
 * 3.5s swell in on --ease-calm, then a 1.2s settle out so a pause feels
 * immediate. A pause mid-swell retargets from the current value, so it reverses
 * without a jump. Reduced motion keeps the brighter, larger state but only
 * crossfades it over 400ms and freezes the breathe exactly where it was.
 *
 * Keep the CSS fallback in step: its extra tint uses intensityBoost - 1, its
 * blur uses blurScale, and its static geometry uses blobScale / blobLift.
 */
export const HORIZON_HOME_LISTENING: HorizonListeningTuning = {
  intensityBoost: 1.9,
  breathePeriod: 12,
  intensityAmp: 0.95,
  blobScale: 1.8,
  blobLift: 12.6,
  blurScale: 1.5,
  inDuration: 3.5,
  outDuration: 1.2,
  reducedDuration: 0.4,
};

/** CSS fallback grain: enough to break 8-bit steps, invisible as texture. */
export const HORIZON_HOME_DITHER: Required<HorizonDither> = {
  enabled: true,
  strength: 3,
  blend: "normal",
};

export const HORIZON_HOME_GRADIENT: HorizonGradientMode = "srgb";

/** WebGL dither, in 8-bit LSBs. 1.5 cuts the longest band run to 5px. */
export const HORIZON_HOME_DITHER_LSB = 1.5;

/** Cap the drawing buffer so the soft glow never renders at 3x. */
export const HORIZON_HOME_DPR_CAP = 1.5;
