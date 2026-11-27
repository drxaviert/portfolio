"use client";

import { useSyncExternalStore } from "react";
import { SKY_TUNING_DEFAULTS, parseSkyTuning } from "./cosmic-sky";
import type { SkyTuning } from "./cosmic-sky";

/**
 * Live store for the cosmic sky tuning. The canvas reads `getSkyTuning()` every
 * frame without a React render; the panel writes through `setSkyTuning`. The
 * default is the preset, so production never reads storage: only the `?tune=1`
 * panel hydrates a saved value.
 */

export const SKY_STORAGE_KEY = "horizon-sky-tuning:v3";

type Listener = () => void;

let current: SkyTuning = SKY_TUNING_DEFAULTS;
const listeners = new Set<Listener>();

export function getSkyTuning(): SkyTuning {
  return current;
}

export function subscribeSkyTuning(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSkyTuning(value: SkyTuning): void {
  current = value;

  for (const listener of listeners) listener();
}

export function loadStoredSkyTuning(): SkyTuning {
  try {
    return parseSkyTuning(window.localStorage.getItem(SKY_STORAGE_KEY));
  } catch {
    return SKY_TUNING_DEFAULTS;
  }
}

export function saveStoredSkyTuning(value: SkyTuning): void {
  try {
    window.localStorage.setItem(SKY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode / quota: tuning still works for this session.
  }
}

export function useSkyTuning(): SkyTuning {
  return useSyncExternalStore(
    subscribeSkyTuning,
    getSkyTuning,
    () => SKY_TUNING_DEFAULTS,
  );
}
