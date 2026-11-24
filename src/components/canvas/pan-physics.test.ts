import { describe, expect, it } from "vitest";
import {
  arrowDirection,
  decayFactor,
  glideDistance,
  glideStepFactor,
  normalizeDirection,
  stepGlide,
} from "./pan-physics";
import type { GlideState } from "./pan-physics";

const DECAY = 0.95;

function simulate(velocity: number, dtFrames: number, frames = 300): number {
  let state: GlideState = { position: 0, velocity };
  let elapsed = 0;

  while (elapsed < frames - 0.0001) {
    const step = Math.min(dtFrames, frames - elapsed);
    state = stepGlide(state, DECAY, step);
    elapsed += step;
  }

  return state.position;
}

describe("glide integrator", () => {
  it("turns a last-delta fling into the expected distance", () => {
    const lastDelta = 100;
    const multiplier = 0.1;
    const releaseVelocity = lastDelta * multiplier * 2;

    // 20px/frame of velocity and a .95 per-frame decay -> 20/.05 = 400px.
    expect(glideDistance(releaseVelocity, DECAY)).toBeCloseTo(400, 6);
  });

  it("matches the 60fps step exactly at one-frame intervals", () => {
    expect(glideStepFactor(DECAY, 1)).toBeCloseTo(1, 12);
    expect(decayFactor(DECAY, 1)).toBeCloseTo(0.95, 12);
  });

  it("stays within 2% at 30, 60 and 120fps", () => {
    const at30 = simulate(20, 2);
    const at60 = simulate(20, 1);
    const at120 = simulate(20, 0.5);
    const reference = at60;

    expect(Math.abs(at30 - reference) / reference).toBeLessThan(0.02);
    expect(Math.abs(at120 - reference) / reference).toBeLessThan(0.02);
  });
});

describe("arrow direction", () => {
  it("normalizes a single axis and a diagonal to the same length", () => {
    const horizontal = normalizeDirection(1, 0);
    const diagonal = normalizeDirection(1, 1);

    expect(Math.hypot(horizontal.x, horizontal.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("returns zero for no input or opposing keys", () => {
    expect(normalizeDirection(0, 0)).toEqual({ x: 0, y: 0 });
    expect(arrowDirection(new Set(["ArrowLeft", "ArrowRight"]))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("combines held arrow keys into one diagonal direction", () => {
    const diagonal = arrowDirection(new Set(["ArrowUp", "ArrowRight"]));

    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2, 6);
  });
});
