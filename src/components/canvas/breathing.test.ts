import { describe, expect, it } from "vitest";
import {
  BREATH,
  breathEnvelope,
  breathPhase,
  breathScale,
  easeBreathLevel,
} from "./breathing";

const CONFIG = { ...BREATH };
const EPSILON = 1e-12;

describe("breathScale", () => {
  it("keeps every scale inside ±amplitude", () => {
    for (let time = 0; time <= 12000; time += 37) {
      for (let col = 0; col < 12; col += 1) {
        for (let row = 0; row < 8; row += 1) {
          const scale = breathScale(time, col, row, CONFIG);

          expect(scale).toBeGreaterThanOrEqual(1 - CONFIG.amplitude - EPSILON);
          expect(scale).toBeLessThanOrEqual(1 + CONFIG.amplitude + EPSILON);
        }
      }
    }
  });

  it("runs the wave diagonally from the grid index", () => {
    const time = 1234;

    expect(breathPhase(time, 1, 0, CONFIG)).toBeCloseTo(
      breathPhase(time, 0, 1, CONFIG),
      12,
    );
    expect(breathPhase(time, 0, 0, CONFIG)).not.toBeCloseTo(
      breathPhase(time, 1, 0, CONFIG),
      6,
    );
  });

  it("keeps the phase continuous across the period and the 2π wrap", () => {
    const time = 2345;
    const col = 7;
    const row = 4;
    const phase = breathPhase(time, col, row, CONFIG);
    const nextPhase = breathPhase(time + CONFIG.periodMs, col, row, CONFIG);

    expect(nextPhase - phase).toBeCloseTo(Math.PI * 2, 12);
    expect(breathScale(time + CONFIG.periodMs, col, row, CONFIG)).toBeCloseTo(
      breathScale(time, col, row, CONFIG),
      12,
    );
    expect(Math.sin(phase + Math.PI * 2)).toBeCloseTo(Math.sin(phase), 12);

    // A wrapped screen position is not an input: the plane keeps the same
    // grid col/row across the seam, so its phase and scale cannot jump.
    expect(breathScale(time, 20, 3, CONFIG)).toBe(
      breathScale(time, 20, 3, CONFIG),
    );
  });
});

describe("breathEnvelope", () => {
  const enabled = { enabled: true, reduced: false };

  it("is exactly zero while moving or disabled", () => {
    expect(
      breathEnvelope(5000, { ...enabled, moving: true, config: CONFIG }),
    ).toBe(0);
    expect(
      breathEnvelope(5000, {
        enabled: false,
        moving: false,
        reduced: false,
        config: CONFIG,
      }),
    ).toBe(0);
    expect(
      breathEnvelope(5000, {
        enabled: true,
        moving: false,
        reduced: true,
        config: CONFIG,
      }),
    ).toBe(0);
  });

  it("waits for the idle delay, then eases over the fade", () => {
    expect(
      breathEnvelope(CONFIG.idleDelayMs - 1, {
        ...enabled,
        moving: false,
        config: CONFIG,
      }),
    ).toBe(0);
    expect(
      breathEnvelope(CONFIG.idleDelayMs, {
        ...enabled,
        moving: false,
        config: CONFIG,
      }),
    ).toBe(0);

    const middle = breathEnvelope(CONFIG.idleDelayMs + CONFIG.fadeMs / 2, {
      ...enabled,
      moving: false,
      config: CONFIG,
    });

    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    expect(
      breathEnvelope(CONFIG.idleDelayMs + CONFIG.fadeMs, {
        ...enabled,
        moving: false,
        config: CONFIG,
      }),
    ).toBe(1);
  });

  it("scales the amplitude with the envelope", () => {
    const half = breathEnvelope(CONFIG.idleDelayMs + CONFIG.fadeMs / 2, {
      ...enabled,
      moving: false,
      config: CONFIG,
    });
    const scale = breathScale(0, 3, 2, {
      ...CONFIG,
      amplitude: CONFIG.amplitude * half,
    });

    expect(Math.abs(scale - 1)).toBeLessThanOrEqual(
      CONFIG.amplitude * half + EPSILON,
    );
  });
});

describe("easeBreathLevel", () => {
  it("fades out quickly when a move starts", () => {
    expect(easeBreathLevel(1, 0, 0, CONFIG)).toBe(1);
    expect(easeBreathLevel(1, 0, CONFIG.fadeOutMs, CONFIG)).toBeLessThan(0.002);
    expect(easeBreathLevel(1, 0, CONFIG.fadeOutMs * 2, CONFIG)).toBe(0);
  });

  it("follows the fade-in curve upward", () => {
    expect(easeBreathLevel(0, 1, 16, CONFIG)).toBe(1);
    expect(easeBreathLevel(0.4, 0.6, 16, CONFIG)).toBe(0.6);
  });
});
