/**
 * The route wipe, as values. `route-wipe` is both the React transition type
 * (passed by `<Link transitionTypes>`) and the view-transition class the CSS
 * targets, so a navigation either opts in whole or not at all.
 *
 * 1.75s is the reference's own duration and the default; 0.9s is the A/B
 * variant. The reduced-motion path is a 200ms crossfade with no movement.
 */
export const ROUTE_MOTION_TYPE = "route-wipe";

export const ROUTE_WIPE_DURATIONS = {
  long: 1750,
  short: 900,
  reduced: 200,
} as const;

export const ROUTE_WIPE_EASE = "cubic-bezier(0.86, 0, 0.07, 1)";

export const ROUTE_MOTION_STORAGE_KEY = "route-motion";

export type RouteMotionVariant = "long" | "short";

export function resolveRouteMotionVariant(
  search: string,
  stored: string | null,
): RouteMotionVariant {
  const requested = new URLSearchParams(search).get("motion");

  if (requested === "short" || requested === "long") return requested;

  return stored === "short" ? "short" : "long";
}

export function routeMotionDurationMs(variant: RouteMotionVariant): number {
  return ROUTE_WIPE_DURATIONS[variant];
}
