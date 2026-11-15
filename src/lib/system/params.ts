// The five source parameters: ranges, clamping, and phase → time of day.

import type { Phase } from "@/lib/theme";
import type { TodPosition } from "@/lib/system/derive";

export type Params = {
  hue: number;
  round: number;
  tod: number;
  contrast: number;
  speed: number;
};

/**
 * Set from the AA grid in `contrast.test.ts`: 0.9 is the lowest 0.05 step at
 * which the shipped brand pairs (`--primary` as text, `--on-primary` on
 * `--primary`) stay at or above their worst shipped ratio, and 2.85 is the
 * highest; 2.9 lets the night brand pair drop below AA.
 */
export const CONTRAST_MIN = 0.9;
export const CONTRAST_MAX = 2.85;

export const PARAM_RANGES: Record<
  keyof Params,
  { min: number; max: number; step: number }
> = {
  hue: { min: -180, max: 180, step: 1 },
  round: { min: 0, max: 2, step: 0.05 },
  tod: { min: 0, max: 1, step: 0.001 },
  contrast: { min: CONTRAST_MIN, max: CONTRAST_MAX, step: 0.05 },
  speed: { min: 0.25, max: 2, step: 0.05 },
};

export const DEFAULT_PARAMS: Params = {
  hue: 0,
  round: 1,
  tod: 1 / 3,
  contrast: 1,
  speed: 1,
};

function clampParam(key: keyof Params, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PARAMS[key];

  const { min, max } = PARAM_RANGES[key];

  return Math.min(max, Math.max(min, value));
}

export function clampParams(params: Params): Params {
  return {
    hue: clampParam("hue", params.hue),
    round: clampParam("round", params.round),
    tod: clampParam("tod", params.tod),
    contrast: clampParam("contrast", params.contrast),
    speed: clampParam("speed", params.speed),
  };
}

export function todForPhase(phase: Phase): TodPosition {
  switch (phase) {
    case "dawn":
      return 0;
    case "day":
      return 1 / 3;
    case "dusk":
      return 2 / 3;
    case "night":
      return 1;
  }
}
