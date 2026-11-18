import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RETARGET_BEZIER,
  easeSpec,
  parseBezier,
} from "@/components/home/carousel/carousel-math";
import { DEFAULT_SETTINGS } from "@/components/home/carousel/carousel-settings";
import {
  CAROUSEL_CLOSE_EASE,
  CAROUSEL_CLOSE_S,
  CAROUSEL_EASE,
  CAROUSEL_OPEN_S,
} from "./carousel-step";

/**
 * The drawer borrows the home carousel's timing for every part of its open and
 * close. These tests keep it borrowing: a retune of the row must move the drawer
 * with it, and the close must stay the run the row gives a step it has to cut
 * short.
 */
describe("the drawer's carousel timing", () => {
  it("opens on the carousel's own step duration and curve", () => {
    expect(CAROUSEL_OPEN_S).toBe(DEFAULT_SETTINGS.duration / 1000);
    expect(CAROUSEL_EASE).toEqual(
      parseBezier(easeSpec(DEFAULT_SETTINGS.ease, DEFAULT_SETTINGS.custom).css),
    );
    // The step as shipped: 900ms on "quick" (carousel-settings.ts).
    expect(CAROUSEL_OPEN_S).toBe(0.9);
    expect(CAROUSEL_EASE).toEqual([0.25, 0.8, 0.25, 1]);
  });

  it("closes on the run the carousel gives an interrupted step", () => {
    expect(CAROUSEL_CLOSE_EASE).toEqual(RETARGET_BEZIER);

    // SETTLE_MS lives inside the carousel component, so it is read from there
    // rather than restated: if the row's settle is retuned, this fails.
    const carousel = readFileSync(
      join(
        process.cwd(),
        "src",
        "components",
        "home",
        "carousel",
        "home-carousel.tsx",
      ),
      "utf8",
    );
    const settle = carousel.match(/const SETTLE_MS = (\d+);/);

    expect(settle).not.toBeNull();
    expect(CAROUSEL_CLOSE_S * 1000).toBe(Number(settle![1]));
  });

  it("borrows no motion from the row, only timing", async () => {
    const step = await import("./carousel-step");

    // The one-pitch travel of the first revision is gone: the drawer keeps its
    // own shape, so there is no distance to borrow.
    expect("slideTravel" in step).toBe(false);
  });
});
