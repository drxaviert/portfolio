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

const PARAM_KEYS: ReadonlyArray<keyof Params> = [
  "hue",
  "round",
  "tod",
  "contrast",
  "speed",
];

/** The last value for `key` that parses to a finite number, if any. */
function lastFiniteValue(query: URLSearchParams, key: string): number | null {
  const values = query.getAll(key);

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const raw = values[index].trim();

    if (raw === "") continue;

    const value = Number(raw);

    if (Number.isFinite(value)) return value;
  }

  return null;
}

/**
 * Reads the five keys from a search string. Unparseable values fall back to
 * the defaults; numeric out-of-range values clamp. `tod` is special: both a
 * missing and an invalid value start at the site phase, so a broken shared
 * link never throws the visitor into a different time of day.
 */
export function parseQuery(search: string, sitePhase: Phase): Params {
  const query = new URLSearchParams(search);
  const read = (key: keyof Params, fallback: number): number =>
    lastFiniteValue(query, key) ?? fallback;

  return clampParams({
    hue: read("hue", DEFAULT_PARAMS.hue),
    round: read("round", DEFAULT_PARAMS.round),
    tod: read("tod", todForPhase(sitePhase)),
    contrast: read("contrast", DEFAULT_PARAMS.contrast),
    speed: read("speed", DEFAULT_PARAMS.speed),
  });
}

function formatParam(value: number): string {
  // The UI steps are at most three decimals; trim float noise from the maths.
  return String(Number(value.toFixed(4)));
}

/**
 * Writes only the keys that differ from the defaults at the current site
 * phase, so the unparameterised URL stays clean.
 */
export function serializeQuery(params: Params, sitePhase: Phase): string {
  const clamped = clampParams(params);
  const defaults: Params = {
    ...DEFAULT_PARAMS,
    tod: todForPhase(sitePhase),
  };
  const parts: string[] = [];

  for (const key of PARAM_KEYS) {
    if (clamped[key] === defaults[key]) continue;

    parts.push(`${key}=${formatParam(clamped[key])}`);
  }

  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}
