"use client";

import { useSyncExternalStore } from "react";

export type OffHomeVariant = "pill" | "nav";

const STORAGE_KEY = "offhome:v1";

let cached: OffHomeVariant | null = null;

function serverVariant(): OffHomeVariant {
  return "pill";
}

/**
 * A client module is evaluated once, before the first client render, so the
 * preference is resolved there. The server render and hydration still use the
 * pill snapshot; the hidden control appearing after hydration changes no
 * pixels.
 */
function readOnce(): OffHomeVariant {
  if (cached) return cached;
  if (process.env.NODE_ENV === "production") {
    cached = "pill";
    return cached;
  }
  if (typeof window === "undefined") return "pill";

  return rememberOffHomeVariant(window.location.search);
}

function subscribeVariant(listener: () => void) {
  // Resolve on the client after hydration and wake the hook once so both the
  // nav control and the provider agree before anything can play.
  readOnce();
  listener();

  return () => {};
}

function getVariantSnapshot(): OffHomeVariant {
  return cached ?? readOnce();
}

function isVariant(value: string | null): value is OffHomeVariant {
  return value === "pill" || value === "nav";
}

/**
 * Reads the A/B choice once per session. An explicit ?offhome wins on the first
 * read; after that the module cache (and sessionStorage across reloads) keeps
 * the variant through client navigations that drop the query.
 *
 * Production always gets the pill: the nav variant is a dev comparison only.
 */
export function rememberOffHomeVariant(search: string): OffHomeVariant {
  if (process.env.NODE_ENV === "production") return "pill";
  if (cached) return cached;

  const param = new URLSearchParams(search).get("offhome");
  let stored: string | null = null;

  try {
    stored = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be denied; the module cache still holds the choice.
  }

  const next: OffHomeVariant = isVariant(param)
    ? param
    : isVariant(stored)
      ? stored
      : "pill";

  cached = next;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Same as above.
  }

  return next;
}

/**
 * Server and hydration use the pill; the resolved client value may be nav
 * after hydration, but its control is hidden until playback starts, so no
 * pixels move. The variant never changes during a session.
 */
export function useOffHomeVariant(): OffHomeVariant {
  return useSyncExternalStore(
    subscribeVariant,
    getVariantSnapshot,
    serverVariant,
  );
}
