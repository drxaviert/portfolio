import { describe, expect, it } from "vitest";
import {
  HOVER,
  hoverIntentReady,
  hoverValue,
  retargetHover,
} from "./hover";
import type { HoverTween } from "./hover";

const LIFT: HoverTween = {
  from: 0,
  to: 1,
  startedAt: 0,
  durationMs: HOVER.inMs,
};

describe("hoverValue", () => {
  it("is 0 at the start, 1 at the end, and monotonic in between", () => {
    expect(hoverValue(LIFT, 0)).toBe(0);
    expect(hoverValue(LIFT, HOVER.inMs)).toBe(1);

    let previous = 0;

    for (let time = 0; time <= HOVER.inMs; time += 10) {
      const value = hoverValue(LIFT, time);

      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it("uses the longer ease-in-out on the way out", () => {
    const lowered = retargetHover(LIFT, 0, HOVER.inMs);

    expect(lowered.durationMs).toBe(HOVER.outMs);
    expect(hoverValue(lowered, HOVER.inMs)).toBe(1);
    expect(
      hoverValue(lowered, HOVER.inMs + HOVER.outMs),
    ).toBe(0);
  });
});

describe("hover intent", () => {
  it("waits 200ms before the cursor/label commit", () => {
    expect(HOVER.intentMs).toBe(200);
    expect(hoverIntentReady(null, 1000)).toBe(false);
    expect(hoverIntentReady(1000, 1199)).toBe(false);
    expect(hoverIntentReady(1000, 1200)).toBe(true);
    expect(hoverIntentReady(1000, 1400)).toBe(true);
  });
});

describe("retargetHover", () => {
  it("retargets from the current value with no discontinuity", () => {
    const first = { ...LIFT };
    const beforeOut = hoverValue(first, 140);
    const out = retargetHover(first, 0, 140);

    expect(hoverValue(out, 140)).toBeCloseTo(beforeOut, 12);

    const beforeIn = hoverValue(out, 220);
    const backIn = retargetHover(out, 1, 220);

    expect(hoverValue(backIn, 220)).toBeCloseTo(beforeIn, 12);
    expect(hoverValue(backIn, 220)).toBeLessThan(beforeIn + 0.000001);
    expect(hoverValue(backIn, 220 + HOVER.inMs)).toBe(1);
  });

  it("never jumps even after a fast pass of several retargets", () => {
    let tween = { ...LIFT };

    for (const [time, to] of [
      [60, 0],
      [90, 1],
      [120, 0],
      [160, 1],
      [210, 0],
    ] as const) {
      const before = hoverValue(tween, time);
      tween = retargetHover(tween, to, time);

      expect(hoverValue(tween, time)).toBeCloseTo(before, 12);

      const later = hoverValue(tween, time + 10);

      if (to > before) expect(later).toBeGreaterThanOrEqual(before);
      else expect(later).toBeLessThanOrEqual(before);
    }
  });
});
