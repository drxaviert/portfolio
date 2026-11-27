"use client";

import { useSyncExternalStore } from "react";
import type { HorizonListeningTuning } from "./horizon-background";
import { HORIZON_HOME_LISTENING, HORIZON_HOME_MOTION } from "./horizon-preset";

/**
 * The dev tuning model for the listening swell.
 *
 * The per-parameter sliders store *base* values at Immersion 1. The master
 * multiplies each value's delta from the resting horizon, so Immersion 0 is the
 * untouched glass, Immersion 1 is the base preset and the default 1.5 is the
 * shipped, more dramatic version. The effective values are clamped so the top
 * of the range stays a glow instead of clipping to a flat white shape.
 *
 * The pure functions here are unit-testable; the small external store is how
 * the shader reads mutable values every frame without a React render, and how
 * the CSS fallback re-renders its pre-styled layer.
 */

export type ListeningTuningParams = {
  /** Strength multiplier at Immersion 1 (1.4 = +40%). */
  strength: number;
  /** Blob scale at Immersion 1. */
  scale: number;
  /** Upward lift at Immersion 1, percent of the viewport. */
  lift: number;
  /** Extra baked blur multiplier at Immersion 1. */
  blur: number;
  /** Peak viewport edge-blur radius, px at the 1440 base. */
  edgeBlurMax: number;
  /** Edge-blur band height, px before the content-margin clamp. */
  edgeBlurHeight: number;
  /** Breathe period at Immersion 1, seconds. */
  period: number;
  /** Intensity swing at Immersion 1. */
  amp: number;
  /** Ramp-in seconds at Immersion 1. */
  rampIn: number;
};

export type ListeningTuningState = {
  immersion: number;
  params: ListeningTuningParams;
};

export const IMMERSION_DEFAULT = 1.5;
export const IMMERSION_MAX = 3;
export const IMMERSION_STEP = 0.05;

export const STORAGE_KEY = "horizon-listen-tuning:v1";

/** Base slider ranges. The effective values are clamped separately below. */
export const LISTENING_PARAM_RANGES = {
  strength: { min: 1, max: 2, step: 0.01 },
  scale: { min: 1, max: 1.7, step: 0.01 },
  lift: { min: 0, max: 20, step: 0.1 },
  blur: { min: 1, max: 2, step: 0.01 },
  edgeBlurMax: { min: 0, max: 32, step: 1 },
  edgeBlurHeight: { min: 80, max: 400, step: 1 },
  period: { min: 6, max: 18, step: 0.5 },
  amp: { min: 0.5, max: 1, step: 0.01 },
  rampIn: { min: 0.5, max: 6, step: 0.1 },
} as const;

export const LISTENING_PARAM_KEYS = Object.keys(
  LISTENING_PARAM_RANGES,
) as (keyof ListeningTuningParams)[];

/** The non-listening rest values the master scales away from. */
const REST_PERIOD = HORIZON_HOME_MOTION.breathePeriod;
const REST_AMP = HORIZON_HOME_MOTION.intensityAmp;

/**
 * Slider bases at Immersion 1, derived from the shipping preset so the default
 * panel state (Immersion 1.5) reproduces the preset exactly.
 */
export const LISTENING_BASE_DEFAULTS: ListeningTuningParams = {
  strength: 1 + (HORIZON_HOME_LISTENING.intensityBoost - 1) / IMMERSION_DEFAULT,
  scale: 1 + (HORIZON_HOME_LISTENING.blobScale - 1) / IMMERSION_DEFAULT,
  lift: HORIZON_HOME_LISTENING.blobLift / IMMERSION_DEFAULT,
  blur: 1 + (HORIZON_HOME_LISTENING.blurScale - 1) / IMMERSION_DEFAULT,
  // Edge blur is an absolute readability budget, not a master-scaled delta.
  edgeBlurMax: HORIZON_HOME_LISTENING.edgeBlurMax,
  edgeBlurHeight: HORIZON_HOME_LISTENING.edgeBlurHeight,
  period:
    REST_PERIOD +
    (HORIZON_HOME_LISTENING.breathePeriod - REST_PERIOD) / IMMERSION_DEFAULT,
  amp:
    REST_AMP +
    (HORIZON_HOME_LISTENING.intensityAmp - REST_AMP) / IMMERSION_DEFAULT,
  rampIn: HORIZON_HOME_LISTENING.inDuration / IMMERSION_DEFAULT,
};

export const DEFAULT_LISTENING_STATE: ListeningTuningState = {
  immersion: IMMERSION_DEFAULT,
  params: LISTENING_BASE_DEFAULTS,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The current look. The master scales every horizon delta from the resting
 * state, then the clamps keep the extreme end from clipping: strength 1.9,
 * scale 1.8, lift 24%, blur 1.9, breathe 20s / amp 0.95, ramp 12s. The edge
 * blur is deliberately excluded: it is an absolute readability budget, so
 * moving Immersion cannot quietly move the safe limit over the chrome.
 */
export function effectiveListening(
  state: ListeningTuningState,
): HorizonListeningTuning {
  const m = clamp(state.immersion, 0, IMMERSION_MAX);
  const p = state.params;
  // Four decimals keeps the default effective values exactly equal to the
  // preset numbers a panel Copy emits; the slider deltas can otherwise land a
  // float ulp away (1.4999999999999998 instead of 1.5).
  const round = (value: number) => Math.round(value * 10000) / 10000;

  return {
    intensityBoost: round(clamp(1 + m * (p.strength - 1), 1, 1.9)),
    breathePeriod: round(
      clamp(REST_PERIOD + m * (p.period - REST_PERIOD), REST_PERIOD, 20),
    ),
    intensityAmp: round(
      clamp(REST_AMP + m * (p.amp - REST_AMP), REST_AMP, 0.95),
    ),
    blobScale: round(clamp(1 + m * (p.scale - 1), 1, 1.8)),
    blobLift: round(clamp(m * p.lift, 0, 24)),
    blurScale: round(clamp(1 + m * (p.blur - 1), 1, 1.9)),
    edgeBlurMax: round(clamp(p.edgeBlurMax, 0, 32)),
    edgeBlurHeight: round(clamp(p.edgeBlurHeight, 80, 400)),
    inDuration: round(clamp(m * p.rampIn, 0, 12)),
    outDuration: HORIZON_HOME_LISTENING.outDuration,
    reducedDuration: HORIZON_HOME_LISTENING.reducedDuration,
  };
}

/** `?tune=1` opens the panel in production; dev builds show it by default. */
export function isTuningEnabled(search: string, isDev: boolean): boolean {
  if (isDev) return true;
  return new URLSearchParams(search).get("tune") === "1";
}

/**
 * Read a persisted state. Missing params fall back to the defaults, malformed
 * JSON or a non-object is ignored, and every number is clamped to its range.
 */
export function parseStoredTuning(
  raw: string | null,
): ListeningTuningState | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const rawParams = record.params;

    if (
      !rawParams ||
      typeof rawParams !== "object" ||
      Array.isArray(rawParams)
    ) {
      return null;
    }

    const paramsRecord = rawParams as Record<string, unknown>;
    const params = { ...LISTENING_BASE_DEFAULTS };

    for (const key of LISTENING_PARAM_KEYS) {
      const value = Number(paramsRecord[key]);
      const range = LISTENING_PARAM_RANGES[key];

      if (Number.isFinite(value)) {
        params[key] = clamp(value, range.min, range.max);
      }
    }

    const immersion = Number(record.immersion);

    return {
      immersion: Number.isFinite(immersion)
        ? clamp(immersion, 0, IMMERSION_MAX)
        : IMMERSION_DEFAULT,
      params,
    };
  } catch {
    return null;
  }
}

export function loadStoredTuning(): ListeningTuningState | null {
  try {
    return parseStoredTuning(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveStoredTuning(state: ListeningTuningState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota: tuning still works for this session.
  }
}

function fmt(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** The effective values as a paste-ready `HORIZON_HOME_LISTENING` snippet. */
export function listeningSnippet(effective: HorizonListeningTuning): string {
  return [
    "export const HORIZON_HOME_LISTENING: HorizonListeningTuning = {",
    `  intensityBoost: ${fmt(effective.intensityBoost)},`,
    `  breathePeriod: ${fmt(effective.breathePeriod)},`,
    `  intensityAmp: ${fmt(effective.intensityAmp)},`,
    `  blobScale: ${fmt(effective.blobScale)},`,
    `  blobLift: ${fmt(effective.blobLift)},`,
    `  blurScale: ${fmt(effective.blurScale)},`,
    `  edgeBlurMax: ${fmt(effective.edgeBlurMax)},`,
    `  edgeBlurHeight: ${fmt(effective.edgeBlurHeight)},`,
    `  inDuration: ${fmt(effective.inDuration)},`,
    `  outDuration: ${fmt(effective.outDuration)},`,
    `  reducedDuration: ${fmt(effective.reducedDuration)},`,
    "};",
  ].join("\n");
}

type Listener = () => void;

let liveTuning: HorizonListeningTuning | null = null;
const liveListeners = new Set<Listener>();

export function getLiveListeningTuning(): HorizonListeningTuning | null {
  return liveTuning;
}

export function subscribeLiveListeningTuning(listener: Listener): () => void {
  liveListeners.add(listener);
  return () => liveListeners.delete(listener);
}

export function setLiveListeningTuning(
  value: HorizonListeningTuning | null,
): void {
  liveTuning = value;

  for (const listener of liveListeners) listener();
}

/**
 * The panel installs the live override; the shader reads it every frame and the
 * CSS fallback subscribes to it. Null means "use the static preset".
 */
export function useLiveListeningTuning(): HorizonListeningTuning | null {
  return useSyncExternalStore(
    subscribeLiveListeningTuning,
    getLiveListeningTuning,
    () => null,
  );
}

let forced = false;
const forceListeners = new Set<Listener>();

export function getListeningForced(): boolean {
  return forced;
}

export function subscribeListeningForced(listener: Listener): () => void {
  forceListeners.add(listener);
  return () => forceListeners.delete(listener);
}

export function setListeningForced(value: boolean): void {
  if (forced === value) return;

  forced = value;

  for (const listener of forceListeners) listener();
}

/** The panel's Force listening toggle, shared with ListeningSync. */
export function useListeningForced(): boolean {
  return useSyncExternalStore(
    subscribeListeningForced,
    getListeningForced,
    () => false,
  );
}
