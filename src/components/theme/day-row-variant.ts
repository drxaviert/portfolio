"use client";

import { useSyncExternalStore } from "react";

/**
 * How a keyboard focus on the Day segment opens the phase row. The choice is a
 * development-only experiment: production always runs "current".
 */
export type DayRowVariant = "current" | "instant" | "on-demand";

export const DAY_ROW_VARIANT_STORAGE_KEY = "theme-day-row-variant";

export const DAY_ROW_VARIANTS: readonly {
  value: DayRowVariant;
  label: string;
}[] = [
  { value: "current", label: "Current" },
  { value: "instant", label: "Instant" },
  { value: "on-demand", label: "On demand" },
];

const listeners = new Set<() => void>();

let snapshot: DayRowVariant | null = null;

function isVariant(value: unknown): value is DayRowVariant {
  return (
    value === "current" || value === "instant" || value === "on-demand"
  );
}

/** Storage can be blocked; whatever is stored, the default is Current. */
function readStored(): DayRowVariant {
  try {
    const stored = window.localStorage.getItem(DAY_ROW_VARIANT_STORAGE_KEY);

    return isVariant(stored) ? stored : "current";
  } catch {
    return "current";
  }
}

export function getDayRowVariant(): DayRowVariant {
  snapshot ??= readStored();

  return snapshot;
}

export function setDayRowVariant(next: DayRowVariant): void {
  snapshot = next;

  try {
    window.localStorage.setItem(DAY_ROW_VARIANT_STORAGE_KEY, next);
  } catch {
    // The switch still works for this page load.
  }

  listeners.forEach((listener) => listener());
}

/** Cycles Current -> Instant -> On demand, for the K shortcut. */
export function cycleDayRowVariant(): void {
  const index = DAY_ROW_VARIANTS.findIndex(
    (variant) => variant.value === getDayRowVariant(),
  );

  setDayRowVariant(DAY_ROW_VARIANTS[(index + 1) % DAY_ROW_VARIANTS.length].value);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Server render and hydration agree on Current; storage is read after. */
function getServerSnapshot(): DayRowVariant {
  return "current";
}

export function useDayRowVariant(): DayRowVariant {
  return useSyncExternalStore(subscribe, getDayRowVariant, getServerSnapshot);
}
