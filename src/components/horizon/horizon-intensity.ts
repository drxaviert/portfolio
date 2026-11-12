/**
 * Breathe-locked intensity.
 *
 * The glow's strength (how much of the blob colour lands on the backdrop) rises
 * and falls with the breathe animation, on the breathe's own period, delay and
 * easing, so the two can never drift apart. The shader drives it per frame from
 * its float clock; the CSS fallback runs the identical envelope as a keyframe on
 * a stacked layer. Both read the numbers from here.
 *
 * Pure: no React, no DOM, no CSS import, so it is unit-testable.
 */

/** Which end of the breath the intensity envelope peaks on. */
export type HorizonIntensityPeak = "expand" | "core";

/**
 * CSS ease-in-out, sampled as x -> y. The y curve is smoothstep in the bezier
 * parameter, but x is solved for; treating x as the parameter would be a
 * different (faster) easing than the CSS layer uses.
 */
const EASE_STEPS = 256;
const EASE_IN_OUT_TABLE = (() => {
  const table = new Float32Array(EASE_STEPS + 1);
  const x1 = 0.42;
  const x2 = 0.58;
  const curve = (t: number, a1: number, a2: number) =>
    3 * (1 - t) * (1 - t) * t * a1 + 3 * (1 - t) * t * t * a2 + t * t * t;

  for (let index = 0; index <= EASE_STEPS; index += 1) {
    const x = index / EASE_STEPS;
    let low = 0;
    let high = 1;

    for (let step = 0; step < 20; step += 1) {
      const mid = (low + high) / 2;

      if (curve(mid, x1, x2) < x) low = mid;
      else high = mid;
    }

    const t = (low + high) / 2;

    table[index] = 3 * t * t - 2 * t * t * t;
  }

  return table;
})();

export function easeInOut(value: number): number {
  const x = Math.min(1, Math.max(0, value)) * EASE_STEPS;
  const index = Math.floor(x);
  const fraction = x - index;
  const a = EASE_IN_OUT_TABLE[index];
  const b = EASE_IN_OUT_TABLE[Math.min(index + 1, EASE_STEPS)];

  return a + (b - a) * fraction;
}

/**
 * The value of an `alternate` CSS animation at `time` seconds. Each iteration
 * runs 0 -> 1 through the timing function, and every other iteration runs it
 * backwards; modelling it as one triangle over the duration would make the
 * shader twice as fast as the CSS it has to match.
 *
 * 0 is the keyframe set's `from` (breathe: scale 1, opacity 1) and 1 is its
 * `to` (breathe: scale max, opacity at its floor).
 */
export function alternateProgress(
  time: number,
  period: number,
  delay: number,
): number {
  const g = (time - delay) / period;
  const iteration = Math.floor(g);
  const progress = g - iteration;
  const eased = easeInOut(progress);

  return iteration % 2 === 0 ? eased : 1 - eased;
}

/**
 * The 0..1 envelope at a breathe progress. Either end is defensible and they
 * look different, so the preset picks:
 *
 * - "core"   peaks at `from`: the blob is at full opacity and full strength
 *            while it is tightest, then spreads and thins out.
 * - "expand" peaks at `to`: strength follows the swell, so the bloom brightens
 *            as it grows and offsets the authored opacity dip.
 */
export function breatheEnvelope(
  progress: number,
  peak: HorizonIntensityPeak = "core",
): number {
  const p = Math.min(1, Math.max(0, progress));

  return peak === "expand" ? p : 1 - p;
}

export type BreatheIntensity = {
  /** Breathe progress at the same clock instant (0 = `from`, 1 = `to`). */
  progress: number;
  /** Peak swing as a fraction of the blob alpha (0.3 = +30%). */
  amp?: number;
  /** Night damping (0.6 = 40% softer). 1 keeps the day swing. */
  nightScale?: number;
  /** 0 = day, 1 = full night; the phase fade interpolates it. */
  nightBlend?: number;
  peak?: HorizonIntensityPeak;
  /** No pulse: intensity stays at 1. */
  reducedMotion?: boolean;
};

export type BaseStrength = {
  /** Glow strength at rest in the day phases, as a multiplier on the alpha. */
  base?: number;
  /** Rest strength in the Night phase; blends over the phase fade. */
  nightBase?: number;
  /** 0 = day, 1 = full night; the phase fade interpolates it. */
  nightBlend?: number;
};

/**
 * The rest strength: `base`, eased towards `nightBase` as the phase fades to
 * Night. It multiplies the blob alpha underneath the breathe pulse, so the two
 * compose instead of replacing each other.
 *
 * The CSS fallback expresses the same line as a calc() on
 * --horizon-base-strength (horizon-motion.css); keep the two in step.
 */
export function baseStrength({
  base = 1,
  nightBase = 1,
  nightBlend = 0,
}: BaseStrength): number {
  const blend = Math.min(1, Math.max(0, nightBlend));

  return base + (nightBase - base) * blend;
}


/**
 * The intensity multiplier for one blob: 1 + effectiveAmp * envelope, where
 * effectiveAmp is damped towards `amp * nightScale` as the phase fades to
 * night. Returns exactly 1 when there is nothing to animate.
 */
export function breatheIntensity({
  progress,
  amp = 0,
  nightScale = 1,
  nightBlend = 0,
  peak = "core",
  reducedMotion = false,
}: BreatheIntensity): number {
  if (reducedMotion || !(amp > 0)) return 1;

  const blend = Math.min(1, Math.max(0, nightBlend));
  const effectiveAmp = amp * (1 - blend * (1 - nightScale));

  if (!(effectiveAmp > 0)) return 1;

  return 1 + effectiveAmp * breatheEnvelope(progress, peak);
}
