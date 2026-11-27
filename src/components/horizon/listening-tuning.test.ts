import { beforeEach, describe, expect, it } from "vitest";
import { HORIZON_HOME_LISTENING, HORIZON_HOME_MOTION } from "./horizon-preset";
import {
  DEFAULT_LISTENING_STATE,
  IMMERSION_DEFAULT,
  LISTENING_BASE_DEFAULTS,
  STORAGE_KEY,
  effectiveListening,
  isTuningEnabled,
  listeningSnippet,
  loadStoredTuning,
  parseStoredTuning,
  saveStoredTuning,
} from "./listening-tuning";
import type { ListeningTuningState } from "./listening-tuning";

function expectDefault(actual: number, expected: number) {
  // The effective values are rounded to four decimals, so the default state
  // must reproduce the preset numbers exactly, not just approximately.
  expect(actual).toBe(expected);
}

describe("listening tuning", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("reproduces the shipping preset at the default Immersion", () => {
    const effective = effectiveListening(DEFAULT_LISTENING_STATE);

    expectDefault(
      effective.intensityBoost,
      HORIZON_HOME_LISTENING.intensityBoost,
    );
    expectDefault(
      effective.breathePeriod,
      HORIZON_HOME_LISTENING.breathePeriod,
    );
    expectDefault(effective.intensityAmp, HORIZON_HOME_LISTENING.intensityAmp);
    expectDefault(effective.blobScale, HORIZON_HOME_LISTENING.blobScale);
    expectDefault(effective.blobLift, HORIZON_HOME_LISTENING.blobLift);
    expectDefault(effective.blurScale, HORIZON_HOME_LISTENING.blurScale);
    expectDefault(effective.inDuration, HORIZON_HOME_LISTENING.inDuration);
    expect(effective.outDuration).toBe(HORIZON_HOME_LISTENING.outDuration);
    expect(effective.reducedDuration).toBe(
      HORIZON_HOME_LISTENING.reducedDuration,
    );
  });

  it("master 0 returns the resting horizon", () => {
    const effective = effectiveListening({
      immersion: 0,
      params: LISTENING_BASE_DEFAULTS,
    });

    expect(effective.intensityBoost).toBe(1);
    expect(effective.blobScale).toBe(1);
    expect(effective.blobLift).toBe(0);
    expect(effective.blurScale).toBe(1);
    expect(effective.breathePeriod).toBe(6);
    expect(effective.intensityAmp).toBe(0.5);
    expect(effective.inDuration).toBe(0);
  });

  it("keeps the idle 6s breathe speed while listening", () => {
    // The shipped listening period is deliberately the same as the idle one:
    // listening deepens the breathe, it does not slow it.
    expect(HORIZON_HOME_LISTENING.breathePeriod).toBe(
      HORIZON_HOME_MOTION.breathePeriod,
    );
    expect(effectiveListening(DEFAULT_LISTENING_STATE).breathePeriod).toBe(
      HORIZON_HOME_MOTION.breathePeriod,
    );
  });

  it("clamps the extreme end so the glow cannot blow out", () => {
    const effective = effectiveListening({
      immersion: 3,
      params: LISTENING_BASE_DEFAULTS,
    });

    expect(effective.intensityBoost).toBe(1.9);
    expect(effective.blobScale).toBeCloseTo(1.8, 10);
    expect(effective.blobLift).toBe(24);
    expect(effective.blurScale).toBe(1.9);
    expect(effective.breathePeriod).toBe(6);
    expect(effective.intensityAmp).toBe(0.95);
    expect(effective.inDuration).toBeCloseTo(7, 10);
  });

  it("still lets a manually raised period stretch the breathe", () => {
    const effective = effectiveListening({
      immersion: 1.5,
      params: { ...LISTENING_BASE_DEFAULTS, period: 18 },
    });

    expect(effective.breathePeriod).toBe(20);
  });

  it("clamps the master itself to 0..3", () => {
    const low = effectiveListening({
      immersion: -1,
      params: LISTENING_BASE_DEFAULTS,
    });
    const high = effectiveListening({
      immersion: 10,
      params: LISTENING_BASE_DEFAULTS,
    });

    expect(low.intensityBoost).toBe(1);
    expect(high.intensityBoost).toBe(1.9);
  });

  it("reads the panel in dev and by ?tune=1 in production", () => {
    expect(isTuningEnabled("", false)).toBe(false);
    expect(isTuningEnabled("?tune=0", false)).toBe(false);
    expect(isTuningEnabled("?tune=1", false)).toBe(true);
    expect(isTuningEnabled("", true)).toBe(true);
    expect(isTuningEnabled("?tune=0", true)).toBe(true);
  });

  it("ignores malformed stored state and clamps a partial one", () => {
    expect(parseStoredTuning(null)).toBeNull();
    expect(parseStoredTuning("not json")).toBeNull();
    expect(parseStoredTuning("[]")).toBeNull();
    expect(parseStoredTuning('{"params": {}}')).toEqual({
      immersion: IMMERSION_DEFAULT,
      params: LISTENING_BASE_DEFAULTS,
    });

    const parsed = parseStoredTuning(
      JSON.stringify({
        immersion: 8,
        params: { strength: 99, scale: "not a number", lift: -4 },
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.immersion).toBe(3);
    expect(parsed?.params.strength).toBe(2);
    expect(parsed?.params.scale).toBe(LISTENING_BASE_DEFAULTS.scale);
    expect(parsed?.params.lift).toBe(0);
    expect(parsed?.params.period).toBe(LISTENING_BASE_DEFAULTS.period);
  });

  it("round-trips through localStorage inside the try/catch wrappers", () => {
    const state: ListeningTuningState = {
      immersion: 2.2,
      params: { ...LISTENING_BASE_DEFAULTS, lift: 12 },
    };

    saveStoredTuning(state);

    expect(loadStoredTuning()).toEqual(state);
  });

  it("copies a paste-ready snippet from the effective values", () => {
    const snippet = listeningSnippet(
      effectiveListening(DEFAULT_LISTENING_STATE),
    );

    expect(snippet).toContain(
      "export const HORIZON_HOME_LISTENING: HorizonListeningTuning = {",
    );
    expect(snippet).toContain("intensityBoost: 1.9,");
    expect(snippet).toContain("breathePeriod: 6,");
    expect(snippet).toContain("intensityAmp: 0.95,");
    expect(snippet).toContain("blobScale: 1.8,");
    expect(snippet).toContain("blobLift: 12.6,");
    expect(snippet).toContain("blurScale: 1.5,");
    expect(snippet).toContain("inDuration: 3.5,");
  });

  it("keeps the default master at 1.5", () => {
    expect(IMMERSION_DEFAULT).toBe(1.5);
  });
});
