import { describe, expect, it } from "vitest";
import {
  DISMISS_RATIO,
  DISMISS_VELOCITY,
  dragOffset,
  releaseVelocity,
  shouldDismiss,
} from "./sheet-drag";

describe("sheet drag", () => {
  it("tracks the pointer 1:1 inside the sheet's travel", () => {
    expect(dragOffset(120, 800)).toBe(120);
    expect(dragOffset(0, 800)).toBe(0);
    expect(dragOffset(800, 800)).toBe(800);
  });

  it("gives way past the closed position instead of hitting a wall", () => {
    // 100px past the closed position moves the sheet a further 15px.
    expect(dragOffset(900, 800)).toBeCloseTo(815);
  });

  it("rubber-bands above the open position", () => {
    expect(dragOffset(-100, 800)).toBeCloseTo(-15);
  });

  it("dismisses past a quarter of the height", () => {
    const height = 800;

    expect(shouldDismiss(height * DISMISS_RATIO, 0, height)).toBe(false);
    expect(shouldDismiss(height * DISMISS_RATIO + 1, 0, height)).toBe(true);
  });

  it("dismisses a short, fast flick", () => {
    expect(shouldDismiss(40, DISMISS_VELOCITY, 800)).toBe(false);
    expect(shouldDismiss(40, DISMISS_VELOCITY + 1, 800)).toBe(true);
  });

  it("reads the speed of the gesture's last 100ms", () => {
    // 300px in 100ms, then a stall that must not dilute the release.
    const samples = [
      { y: 0, t: 0 },
      { y: 300, t: 100 },
      { y: 300, t: 400 },
    ];

    expect(releaseVelocity(samples)).toBe(0);
    expect(releaseVelocity(samples.slice(0, 2))).toBe(3000);
  });

  it("falls back to zero without enough gesture to read", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ y: 200, t: 50 }])).toBe(0);
    expect(
      releaseVelocity([
        { y: 0, t: 100 },
        { y: 0, t: 100 },
      ]),
    ).toBe(0);
  });

  it("clamps a fling to a sane speed", () => {
    expect(
      releaseVelocity([
        { y: 0, t: 0 },
        { y: 5000, t: 10 },
      ]),
    ).toBe(6000);
  });
});
