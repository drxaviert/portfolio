import { describe, expect, it } from "vitest";
import {
  RETARGET_BEZIER,
  easeSpec,
  parseBezier,
} from "@/components/home/carousel/carousel-math";
import { DEFAULT_SETTINGS } from "@/components/home/carousel/carousel-settings";
import {
  CAROUSEL_EASE,
  CAROUSEL_OPEN_S,
  DRAWER_CLOSE_EASE,
  DRAWER_CLOSE_S,
} from "./carousel-step";

/**
 * The drawer borrows the home carousel's timing for its open and keeps
 * Stripe's dialog timing for its close. These tests keep the open borrowing (a
 * retune of the row must move the drawer's open with it) and pin the close.
 */
describe("the drawer's timing", () => {
  it("opens on the carousel's own step duration and curve", () => {
    expect(CAROUSEL_OPEN_S).toBe(DEFAULT_SETTINGS.duration / 1000);
    expect(CAROUSEL_EASE).toEqual(
      parseBezier(easeSpec(DEFAULT_SETTINGS.ease, DEFAULT_SETTINGS.custom).css),
    );
    // The step as shipped: 900ms on "quick" (carousel-settings.ts).
    expect(CAROUSEL_OPEN_S).toBe(0.9);
    expect(CAROUSEL_EASE).toEqual([0.25, 0.8, 0.25, 1]);
  });

  it("closes on Stripe's 300ms CSS ease, not the carousel's settle", () => {
    expect(DRAWER_CLOSE_S).toBe(0.3);
    // CSS `ease` as a bezier: what the backdrop and content fades name in
    // drawer-shell.css, so the panel and its fades share one curve.
    expect(DRAWER_CLOSE_EASE).toEqual([0.25, 0.1, 0.25, 1]);
    expect(DRAWER_CLOSE_EASE).not.toEqual(RETARGET_BEZIER);
    // Still quicker than the open, the asymmetry the row has.
    expect(DRAWER_CLOSE_S).toBeLessThan(CAROUSEL_OPEN_S);
  });

  it("borrows no motion from the row, only timing", async () => {
    const step = await import("./carousel-step");

    // The one-pitch travel of the first revision is gone: the drawer keeps its
    // own shape, so there is no distance to borrow.
    expect("slideTravel" in step).toBe(false);
  });
});
