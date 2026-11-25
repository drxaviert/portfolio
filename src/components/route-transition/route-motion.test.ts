import { describe, expect, it } from "vitest";
import {
  ROUTE_MOTION_TYPE,
  ROUTE_WIPE_DURATIONS,
  ROUTE_WIPE_EASE,
  resolveRouteMotionVariant,
  routeMotionDurationMs,
} from "./route-motion";

describe("route motion", () => {
  it("exposes the approved long and short route-wipe durations", () => {
    expect(ROUTE_MOTION_TYPE).toBe("route-wipe");
    expect(ROUTE_WIPE_DURATIONS.long).toBe(1750);
    expect(ROUTE_WIPE_DURATIONS.short).toBe(900);
    expect(ROUTE_WIPE_DURATIONS.reduced).toBe(200);
    expect(ROUTE_WIPE_EASE).toBe("cubic-bezier(0.86, 0, 0.07, 1)");
    expect(routeMotionDurationMs("long")).toBe(1750);
    expect(routeMotionDurationMs("short")).toBe(900);
  });

  it("lets a valid query parameter win and persist", () => {
    expect(resolveRouteMotionVariant("?motion=short", null)).toBe("short");
    expect(resolveRouteMotionVariant("?motion=long", "short")).toBe("long");
  });

  it("falls back to the stored variant when the query is absent or invalid", () => {
    expect(resolveRouteMotionVariant("", "short")).toBe("short");
    expect(resolveRouteMotionVariant("?motion=medium", "short")).toBe("short");
    expect(resolveRouteMotionVariant("", null)).toBe("long");
    expect(resolveRouteMotionVariant("?motion=", "nonsense")).toBe("long");
  });
});
