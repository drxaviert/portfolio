import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  alternateProgress,
  baseStrength,
  breatheEnvelope,
  breatheIntensity,
} from "./horizon-intensity";

const PERIOD = 6;
const SCALE = 0.06;
const DEPTH = 0.3;

/** The breathe values the shader derives from the same progress, for checks. */
function breatheAt(time: number, delay = 0) {
  const progress = alternateProgress(time, PERIOD, delay);

  return {
    progress,
    scale: 1 + SCALE * progress,
    opacity: 1 - DEPTH * progress,
  };
}

function envelopeAt(time: number, peak: "core" | "expand", delay = 0): number {
  return breatheEnvelope(alternateProgress(time, PERIOD, delay), peak);
}

/** Highest envelope value in one 12s breath, sampled at 10ms. */
function sampledPeak(peak: "core" | "expand", delay = 0): number {
  let best = 0;

  for (let time = 0; time <= PERIOD * 2; time += 0.01) {
    best = Math.max(best, envelopeAt(time, peak, delay));
  }

  return best;
}

describe("breathe intensity envelope", () => {
  it("peaks at the breathe maximum for both phases", () => {
    // "core": the breathe `from` state, where opacity is at its maximum.
    expect(breatheEnvelope(0, "core")).toBe(1);
    expect(breatheEnvelope(1, "core")).toBe(0);
    expect(envelopeAt(0, "core")).toBeCloseTo(sampledPeak("core"), 6);
    expect(breatheAt(0).opacity).toBeCloseTo(1, 6);

    // "expand": the breathe `to` state, where the scale is at its maximum.
    expect(breatheEnvelope(0, "expand")).toBe(0);
    expect(breatheEnvelope(1, "expand")).toBe(1);
    expect(envelopeAt(PERIOD, "expand")).toBeCloseTo(
      sampledPeak("expand"),
      6,
    );
    expect(breatheAt(PERIOD).scale).toBeCloseTo(1 + SCALE, 6);
  });

  it("holds the breathe rhythm: one peak per 6s keyframe, no faster", () => {
    for (const peak of ["core", "expand"] as const) {
      const direction = peak === "core" ? -1 : 1;

      // The 6s breathe keyframes, then the alternate iteration mirroring them.
      expect(envelopeAt(0, peak)).toBeCloseTo(peak === "core" ? 1 : 0, 6);
      expect(envelopeAt(PERIOD, peak)).toBeCloseTo(peak === "core" ? 0 : 1, 6);
      expect(envelopeAt(PERIOD * 2, peak)).toBeCloseTo(
        envelopeAt(0, peak),
        6,
      );

      // Strictly monotone between those two ends: no added wobble or period.
      let previous = envelopeAt(0, peak);

      for (let time = 0.05; time <= PERIOD; time += 0.05) {
        const value = envelopeAt(time, peak);

        expect((value - previous) * direction).toBeGreaterThanOrEqual(-1e-9);
        previous = value;
      }
    }
  });

  it("runs blob 2 half a cycle behind blob 1", () => {
    for (const peak of ["core", "expand"] as const) {
      for (const time of [0, 1.5, 3, 8.25]) {
        expect(envelopeAt(time, peak, -PERIOD / 2)).toBeCloseTo(
          envelopeAt(time + PERIOD / 2, peak),
          6,
        );
      }
    }
  });

  it("scales the blob alpha by 1 + amp * envelope", () => {
    const at = (progress: number) =>
      breatheIntensity({ progress, amp: 0.3, peak: "core" });

    expect(at(0)).toBeCloseTo(1.3, 6);
    expect(at(0.5)).toBeCloseTo(1.15, 6);
    expect(at(1)).toBeCloseTo(1, 6);
  });

  it("damps the amp towards amp * night scale as the phase fades", () => {
    const peak = (nightBlend: number) =>
      breatheIntensity({
        progress: 0,
        amp: 0.5,
        nightScale: 0.6,
        nightBlend,
        peak: "core",
      });

    expect(peak(0)).toBeCloseTo(1.5, 6);
    expect(peak(0.5)).toBeCloseTo(1.4, 6);
    expect(peak(1)).toBeCloseTo(1.3, 6);
  });

  it("pins intensity to 1 under reduced motion and at amp 0", () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      expect(
        breatheIntensity({ progress, amp: 0.6, reducedMotion: true }),
      ).toBe(1);
      expect(breatheIntensity({ progress, amp: 0 })).toBe(1);
    }
  });
});

describe("rest strength", () => {
  it("eases from the day base to the night base over the phase fade", () => {
    expect(baseStrength({ base: 4, nightBase: 2.5, nightBlend: 0 })).toBe(4);
    expect(baseStrength({ base: 4, nightBase: 2.5, nightBlend: 0.5 })).toBe(
      3.25,
    );
    expect(baseStrength({ base: 4, nightBase: 2.5, nightBlend: 1 })).toBe(2.5);
    // The shipped preset: a multiplier of exactly 1 at both ends.
    expect(baseStrength({ base: 1, nightBase: 1, nightBlend: 1 })).toBe(1);
    expect(baseStrength({})).toBe(1);
  });

  it("composes with the pulse: strength * (1 + amp * envelope)", () => {
    const tuned = { base: 4, nightBase: 2.5, nightBlend: 1 };
    const alpha = 0.06;
    const strength = baseStrength(tuned);
    const pulse = breatheIntensity({ progress: 0, amp: 0.3, peak: "core" });

    expect(strength).toBe(2.5);
    expect(alpha * strength * pulse).toBeCloseTo(0.06 * 2.5 * 1.3, 10);
  });
});

describe("CSS intensity layer", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "components", "horizon", "horizon-motion.css"),
    "utf8",
  );

  it("runs the envelope on the breathe period and delay", () => {
    const rule = /\.horizon-motion-intensity \{[\s\S]*?\}/.exec(css)?.[0] ?? "";

    expect(rule).toContain("animation: horizon-intensity");
    expect(rule).toContain("var(--horizon-breathe-period");
    expect(rule).toContain("var(--horizon-breathe-delay");
    // "expand" is the same timeline, played the other way: no restart, no drift.
    expect(css).toMatch(
      /\[data-peak="expand"\] \{\s*animation-direction: alternate;/,
    );
  });

  it("turns the pulse off under reduced motion", () => {
    const reduced = css.slice(css.indexOf("Strength stays at 1"));
    const rule = /\.horizon-motion-intensity \{[\s\S]*?\}/.exec(reduced)?.[0] ?? "";

    expect(rule).toContain("display: none");
  });
});
