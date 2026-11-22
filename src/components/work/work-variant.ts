"use client";

import { useSyncExternalStore } from "react";

/**
 * The /work prototype switch: one value for the whole document, read from
 * `?wv=` first and remembered in localStorage after that.
 *
 * This is a review aid, not product state. Nothing on the route reads it on the
 * server, so the server snapshot is always `current` and hydration settles on
 * the remembered value a beat later — the pill and the index swap together.
 */
export type WorkVariant = "current" | "a-full" | "a-grow" | "a-plain" | "e2";

export const WORK_VARIANTS: readonly WorkVariant[] = [
  "current",
  "a-full",
  "a-grow",
  "a-plain",
  "e2",
];

export const WORK_VARIANT_LABELS: Record<WorkVariant, string> = {
  current: "Current",
  "a-full": "A · full",
  "a-grow": "A · grow",
  "a-plain": "A · plain",
  e2: "E2",
};

export const WORK_VARIANT_NOTES: Record<WorkVariant, string> = {
  current: "Today's /work, unchanged",
  "a-full": "Storyboard: surface, grow, bands, list (~2.4s)",
  "a-grow": "Recommended: surface and one shared card (~1.1s)",
  "a-plain": "Surface open only, no shared element",
  e2: "List only, with one shared left-margin thumbnail",
};

const STORAGE_KEY = "wd-work-variant";
const VALID = new Set<string>(WORK_VARIANTS);

let variant: WorkVariant | null = null;
let hasParam: boolean | null = null;
const listeners = new Set<() => void>();

export function isWorkVariant(value: string | null): value is WorkVariant {
  return value !== null && VALID.has(value);
}

function readParam(): WorkVariant | null {
  try {
    const value = new URLSearchParams(window.location.search).get("wv");
    return isWorkVariant(value) ? value : null;
  } catch {
    return null;
  }
}

function readStored(): WorkVariant | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isWorkVariant(value) ? value : null;
  } catch {
    return null;
  }
}

function readVariant(): WorkVariant {
  const param = readParam();

  if (param) {
    // The query is the shareable form: opening a link with `?wv` also makes it
    // the remembered choice for the next visit.
    try {
      window.localStorage.setItem(STORAGE_KEY, param);
    } catch {
      // Storage is a convenience; the query still drives this visit.
    }

    return param;
  }

  return readStored() ?? "current";
}

function readHasParam(): boolean {
  return readParam() !== null;
}

function emit() {
  for (const listener of listeners) listener();
}

export function getWorkVariantSnapshot(): WorkVariant {
  variant ??= readVariant();

  return variant;
}

export function getWorkVariantServerSnapshot(): WorkVariant {
  return "current";
}

export function getWorkVariantParamSnapshot(): boolean {
  hasParam ??= readHasParam();

  return hasParam;
}

export function getWorkVariantParamServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setWorkVariant(next: WorkVariant) {
  if (variant === next) return;

  variant = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // A blocked storage still lets the pill drive this visit.
  }

  emit();
}

/** The switcher wrote a `?wv=` URL: the pill may stay visible in production. */
export function noteWorkVariantParam(present = true) {
  if (hasParam === present) return;

  hasParam = present;
  emit();
}

export function useWorkVariant(): WorkVariant {
  return useSyncExternalStore(
    subscribe,
    getWorkVariantSnapshot,
    getWorkVariantServerSnapshot,
  );
}

export function useWorkVariantParam(): boolean {
  return useSyncExternalStore(
    subscribe,
    getWorkVariantParamSnapshot,
    getWorkVariantParamServerSnapshot,
  );
}

/**
 * Back/Forward can change the query string without a remount. Re-read both the
 * query and the stored value so the pill and the index follow the URL.
 */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    variant = null;
    hasParam = null;
    emit();
  });
}
