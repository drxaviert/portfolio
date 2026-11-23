import { describe, expect, it } from "vitest";
import {
  arrowDirection,
  estimateReleaseVelocity,
  normalizeDirection,
  releaseGain,
} from "./pan-physics";
import type { PointerSample, ReleaseGainOptions } from "./pan-physics";

const SAMPLE_OPTIONS = { windowMs: 90, staleMs: 80, minGapMs: 8 };

const GAIN_OPTIONS: ReleaseGainOptions = {
  minGain: 0.2,
  maxGain: 1.6,
  slowPxPerMs: 0.35,
  fastPxPerMs: 2.2,
  touchScale: 1.25,
};

function samples(points: [number, number][]): PointerSample[] {
  return points.map(([t, x]) => ({ t, x, y: 0 }));
}

describe("estimateReleaseVelocity", () => {
  it("averages a hard flick over the recent window", () => {
    const velocity = estimateReleaseVelocity(
      samples([
        [1000, 0],
        [1016.7, 40],
        [1033.4, 80],
      ]),
      1040,
      SAMPLE_OPTIONS,
    );

    expect(velocity?.x).toBeCloseTo(80 / 33.4, 2);
    expect(velocity?.y).toBe(0);
  });

  it("leaves a slow release with only a small velocity", () => {
    const velocity = estimateReleaseVelocity(
      samples([
        [0, 0],
        [50, 10],
        [100, 20],
      ]),
      110,
      SAMPLE_OPTIONS,
    );

    expect(velocity?.x).toBeCloseTo(0.2, 6);
  });

  it("ignores a pause longer than the stale window", () => {
    expect(
      estimateReleaseVelocity(
        samples([
          [0, 0],
          [50, 20],
          [100, 40],
        ]),
        190,
        SAMPLE_OPTIONS,
      ),
    ).toBeNull();
  });

  it("ignores a single sample", () => {
    expect(
      estimateReleaseVelocity(samples([[0, 0]]), 10, SAMPLE_OPTIONS),
    ).toBeNull();
  });

  it("uses only the samples inside the window", () => {
    const velocity = estimateReleaseVelocity(
      samples([
        [0, 0],
        [200, 100],
        [250, 120],
      ]),
      260,
      SAMPLE_OPTIONS,
    );

    expect(velocity?.x).toBeCloseTo(20 / 50, 6);
  });

  it("falls back to the previous sample at a low event rate", () => {
    const velocity = estimateReleaseVelocity(
      samples([
        [0, 0],
        [100, 0],
        [190, 90],
      ]),
      200,
      SAMPLE_OPTIONS,
    );

    expect(velocity?.x).toBeCloseTo(1, 6);
  });
});

describe("releaseGain", () => {
  it("keeps a gentle release restrained and a hard flick fast", () => {
    const gentle = releaseGain(0.2, false, GAIN_OPTIONS);
    const hard = releaseGain(2.4, false, GAIN_OPTIONS);

    expect(gentle).toBeCloseTo(0.2, 6);
    expect(hard).toBeCloseTo(1.6, 6);
    expect(hard).toBeGreaterThan(gentle * 5);
  });

  it("is monotonic and clamps at the fast end", () => {
    const samplesAt = [0.35, 0.8, 1.4, 2.2, 4].map((speed) =>
      releaseGain(speed, false, GAIN_OPTIONS),
    );

    for (let index = 1; index < samplesAt.length; index += 1) {
      expect(samplesAt[index]).toBeGreaterThanOrEqual(samplesAt[index - 1]);
    }

    expect(samplesAt.at(-1)).toBeCloseTo(1.6, 6);
  });

  it("makes touch releases a little stronger", () => {
    expect(releaseGain(1.4, true, GAIN_OPTIONS)).toBeCloseTo(
      releaseGain(1.4, false, GAIN_OPTIONS) * 1.25,
      6,
    );
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
