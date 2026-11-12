import type {
  HorizonDither,
  HorizonGradientMode,
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
 * `intensityAmp` stays at 0 until a value is picked from /dev/proto/horizon: 0
 * is the untouched picture, and the breathe carries no strength pulse.
 */
export const HORIZON_HOME_MOTION: Required<HorizonMotionTuning> = {
  driftPeriod: 30,
  driftTravelX: 15,
  driftTravelY: 10,
  breathePeriod: 6,
  breatheScale: 6,
  breatheDepth: 30,
  intensityAmp: 0,
  /** Night glows dimmer, so the pulse is softer there. */
  nightIntensityScale: 0.6,
  /** Strength peaks while the blob is tight and opaque. */
  intensityPeak: "core",
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
