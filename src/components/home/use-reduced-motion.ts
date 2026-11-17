"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * The server cannot know the preference, so it renders the un-reduced page and
 * the client corrects on hydration. This is the same default Motion's
 * `useReducedMotion` uses (`false`, not `null`), so the home route behaves
 * exactly as it did while importing that hook.
 */
function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
