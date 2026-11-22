"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  currentBackMenuVariant,
  readBackMenuVariantFromSearch,
  storeBackMenuVariant,
  subscribeBackMenuVariant,
} from "./back-menu-variant";
import type { BackMenuVariant } from "./back-menu-variant";

/**
 * The live variant. The URL wins on first mount, then the remembered choice.
 * The server and the hydration paint use the dropdown; the external-store read
 * swaps in the remembered variant right after, before any menu can open.
 */
export function useBackMenuVariant(): BackMenuVariant {
  const variant = useSyncExternalStore(
    subscribeBackMenuVariant,
    currentBackMenuVariant,
    () => "dropdown" as const,
  );

  // A shared `?bm=` link seeds this browser's memory for the next visit.
  useEffect(() => {
    const fromSearch = readBackMenuVariantFromSearch(window.location.search);

    if (fromSearch) storeBackMenuVariant(fromSearch);
  }, []);

  return variant;
}
