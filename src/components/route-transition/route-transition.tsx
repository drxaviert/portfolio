"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { ROUTE_MOTION_TYPE } from "./route-motion";

/**
 * The page-level view-transition participant. It only animates when the
 * navigation carries the `route-wipe` type, so the Work drawer's own morph
 * (and every other route change) keeps its shipped motion.
 *
 * `data-route-transition` lets the CSS free the page from the transition
 * overlay while a wipe is running, so a click mid-wipe reaches the live page
 * instead of being swallowed. The callbacks run before/around the browser's
 * transition; the count keeps the flag alive when the old and new views both
 * register it.
 */
let activeRouteTransitions = 0;

function markRouteTransition(types: string[]): (() => void) | undefined {
  if (!types.includes(ROUTE_MOTION_TYPE)) return undefined;

  activeRouteTransitions += 1;
  document.documentElement.setAttribute("data-route-transition", "");

  return () => {
    activeRouteTransitions = Math.max(0, activeRouteTransitions - 1);
    if (activeRouteTransitions === 0) {
      document.documentElement.removeAttribute("data-route-transition");
    }
  };
}

export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ [ROUTE_MOTION_TYPE]: ROUTE_MOTION_TYPE, default: "none" }}
      exit={{ [ROUTE_MOTION_TYPE]: ROUTE_MOTION_TYPE, default: "none" }}
      default="none"
      onEnter={(_instance, types) => markRouteTransition(types)}
      onExit={(_instance, types) => markRouteTransition(types)}
    >
      {children}
    </ViewTransition>
  );
}
