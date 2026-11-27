import { describe, expect, it } from "vitest";
import {
  createWaveConfig,
  sampleWave,
  shadowForLift,
  SHADOW_LIFT_FADE,
  SHADOW_LIFT_OFFSET,
  SHADOW_LIFT_SCALE,
  WAVE_COLUMN_PHASE,
  WAVE_MAX_AMPLITUDE,
  WAVE_MAX_PERIOD,
  WAVE_MAX_TURN,
  WAVE_MIN_AMPLITUDE,
  WAVE_MIN_PERIOD,
  WAVE_MIN_TURN,
  WAVE_ROW_PHASE,
} from "./motion";

function seeded(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    state = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
    state = Math.imul(state ^ (state >>> 15), 0x735a2d97);

    return ((state ^ (state >>> 15)) >>> 0) / 4294967296;
  };
}

describe("idle wave", () => {
  it("gives each grid position its own phase", () => {
    const origin = createWaveConfig(0, 0, () => 0.5);
    const right = createWaveConfig(1, 0, () => 0.5);
    const down = createWaveConfig(0, 1, () => 0.5);

    expect(right.phase - origin.phase).toBeCloseTo(WAVE_COLUMN_PHASE, 9);
    expect(down.phase - origin.phase).toBeCloseTo(WAVE_ROW_PHASE, 9);
    expect(
      new Set(
        [origin.phase, right.phase, down.phase].map((phase) =>
          phase.toFixed(6),
        ),
      ).size,
    ).toBe(3);
  });

  it("gives different objects slightly different periods", () => {
    const random = seeded(42);
    const configs = Array.from({ length: 12 }, (_, index) =>
      createWaveConfig(index % 4, Math.floor(index / 4), random),
    );

    expect(
      new Set(configs.map((config) => config.period.toFixed(4))).size,
    ).toBeGreaterThan(6);
  });

  it("keeps period, amplitude and turn bounded", () => {
    const random = seeded(7);

    for (let index = 0; index < 60; index += 1) {
      const config = createWaveConfig(index % 9, Math.floor(index / 9), random);

      expect(config.period).toBeGreaterThanOrEqual(WAVE_MIN_PERIOD);
      expect(config.period).toBeLessThanOrEqual(WAVE_MAX_PERIOD);
      expect(config.amplitude).toBeGreaterThanOrEqual(WAVE_MIN_AMPLITUDE);
      expect(config.amplitude).toBeLessThanOrEqual(WAVE_MAX_AMPLITUDE);
      expect(config.turn).toBeGreaterThanOrEqual(WAVE_MIN_TURN);
      expect(config.turn).toBeLessThanOrEqual(WAVE_MAX_TURN);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(createWaveConfig(3, 2, seeded(123))).toEqual(
      createWaveConfig(3, 2, seeded(123)),
    );
  });

  it("stays inside the amplitude and turn bounds over time", () => {
    const config = createWaveConfig(2, 1, () => 0.75);

    for (let time = 0; time < 20; time += 0.05) {
      const sample = sampleWave(config, time, false);

      expect(Math.abs(sample.z)).toBeLessThanOrEqual(config.amplitude + 1e-9);
      expect(Math.abs(sample.turnX)).toBeLessThanOrEqual(config.turn + 1e-9);
      expect(Math.abs(sample.turnY)).toBeLessThanOrEqual(
        config.turn * 0.7 + 1e-9,
      );
    }
  });

  it("wraps exactly with its period", () => {
    const config = createWaveConfig(1, 1, () => 0.3);
    const start = sampleWave(config, 1.2, false);
    const wrapped = sampleWave(config, 1.2 + config.period, false);

    expect(wrapped.z).toBeCloseTo(start.z, 9);
    expect(wrapped.turnX).toBeCloseTo(start.turnX, 9);
    expect(wrapped.turnY).toBeCloseTo(start.turnY, 9);
  });

  it("couples the turn to the bob phase", () => {
    const config = {
      phase: 0,
      period: 6,
      amplitude: 2,
      turn: 0.05,
    };
    const mid = sampleWave(config, 0, false);
    const top = sampleWave(config, config.period / 4, false);

    expect(mid.z).toBeCloseTo(0, 9);
    expect(mid.turnX).toBeCloseTo(config.turn, 9);
    expect(top.z).toBeCloseTo(config.amplitude, 9);
    expect(top.turnX).toBeCloseTo(0, 9);
  });

  it("is exactly still under reduced motion", () => {
    const config = createWaveConfig(1, 2, () => 0.9);

    expect(sampleWave(config, 123.45, true)).toEqual({
      z: 0,
      turnX: 0,
      turnY: 0,
    });
  });
});

describe("shadow lift", () => {
  it("keeps the base at rest", () => {
    expect(shadowForLift(0, 0.5)).toEqual({
      scale: 1,
      opacity: 0.5,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("spreads, fades and moves lower-right when the prop is high", () => {
    const shadow = shadowForLift(1, 0.5);

    expect(shadow.scale).toBeCloseTo(1 + SHADOW_LIFT_SCALE, 9);
    expect(shadow.opacity).toBeCloseTo(0.5 * (1 - SHADOW_LIFT_FADE), 9);
    expect(shadow.offsetX).toBeCloseTo(SHADOW_LIFT_OFFSET, 9);
    expect(shadow.offsetY).toBeCloseTo(-SHADOW_LIFT_OFFSET, 9);
  });

  it("tightens and darkens when the prop is low", () => {
    const shadow = shadowForLift(-1, 0.5);

    expect(shadow.scale).toBeLessThan(1);
    expect(shadow.opacity).toBeGreaterThan(0.5);
    expect(shadow.offsetX).toBeLessThan(0);
    expect(shadow.offsetY).toBeGreaterThan(0);
  });

  it("clamps lift outside the wave", () => {
    expect(shadowForLift(2, 0.5)).toEqual(shadowForLift(1, 0.5));
    expect(shadowForLift(-2, 0.5)).toEqual(shadowForLift(-1, 0.5));
  });
});
