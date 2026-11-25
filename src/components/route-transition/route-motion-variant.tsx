"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  ROUTE_MOTION_STORAGE_KEY,
  ROUTE_WIPE_DURATIONS,
  ROUTE_WIPE_EASE,
  resolveRouteMotionVariant,
  routeMotionDurationMs,
} from "./route-motion";

/**
 * The A/B switch. `?motion=short` selects the 0.9s wipe, `?motion=long` the
 * 1.75s default; the choice persists in the tab so it survives a route change.
 * The duration lands as a custom property on <html>, which is what the
 * ::view-transition rules read.
 */
export function RouteMotionVariant() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = window.localStorage.getItem(ROUTE_MOTION_STORAGE_KEY);
    } catch {
      // Private modes can refuse storage; the query still works for this view.
    }

    const variant = resolveRouteMotionVariant(
      search ? `?${search}` : "",
      stored,
    );
    const root = document.documentElement;

    root.dataset.routeMotion = variant;
    root.style.setProperty(
      "--route-wipe-duration",
      `${routeMotionDurationMs(variant)}ms`,
    );
    root.style.setProperty(
      "--route-wipe-reduced-duration",
      `${ROUTE_WIPE_DURATIONS.reduced}ms`,
    );
    root.style.setProperty("--route-wipe-ease", ROUTE_WIPE_EASE);

    try {
      window.localStorage.setItem(ROUTE_MOTION_STORAGE_KEY, variant);
    } catch {
      // Same private-mode guard as above.
    }
  }, [search]);

  return null;
}
