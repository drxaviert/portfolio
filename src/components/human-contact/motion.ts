/**
 * The idle motion model: one object's Z bob, its coupled turn, and the shadow
 * response to that lift.
 *
 * All three are pure so they can be tested without WebGL. The scene supplies a
 * deterministic per-index random function; the wave itself is a function of
 * absolute clock time, so 30 fps and 144 fps trace the same curve.
 */
export type WaveConfig = {
  /** Radians. Follows the grid so neighbouring cells are out of step. */
  phase: number;
  /** Seconds for one full bob. Slightly different per object. */
  period: number;
  /** World units; the Z distance from the rest height. */
  amplitude: number;
  /** Radians of coupled turn at the steepest point. */
  turn: number;
};

export type WaveSample = {
  z: number;
  turnX: number;
  turnY: number;
};

export const WAVE_MIN_PERIOD = 5.4;
export const WAVE_MAX_PERIOD = 6.8;
export const WAVE_MIN_AMPLITUDE = 1.25;
export const WAVE_MAX_AMPLITUDE = 2;
export const WAVE_MIN_TURN = 0.03;
export const WAVE_MAX_TURN = 0.06;
export const WAVE_COLUMN_PHASE = 0.62;
export const WAVE_ROW_PHASE = 0.47;
export const WAVE_PHASE_JITTER = 1.1;

export const SHADOW_LIFT_SCALE = 0.16;
export const SHADOW_LIFT_FADE = 0.18;
export const SHADOW_LIFT_OFFSET = 1.3;

/**
 * One object's wave. The phase advances across columns and down rows, then
 * takes a little per-object jitter so the field never reads as a machined
 * lattice. The period and amplitude are seeded per object.
 */
export function createWaveConfig(
  col: number,
  row: number,
  random: (salt: number) => number,
): WaveConfig {
  const jitter = (random(1) - 0.5) * WAVE_PHASE_JITTER;

  return {
    phase: col * WAVE_COLUMN_PHASE + row * WAVE_ROW_PHASE + jitter,
    period: WAVE_MIN_PERIOD + random(2) * (WAVE_MAX_PERIOD - WAVE_MIN_PERIOD),
    amplitude:
      WAVE_MIN_AMPLITUDE +
      random(3) * (WAVE_MAX_AMPLITUDE - WAVE_MIN_AMPLITUDE),
    turn: WAVE_MIN_TURN + random(4) * (WAVE_MAX_TURN - WAVE_MIN_TURN),
  };
}

/**
 * The bob at a clock time. `turnX` is the derivative-shaped turn: strongest
 * while the object crosses the middle, zero at the top and bottom. `turnY` is
 * a smaller yaw offset on the same clock, so rising and turning read as one
 * gesture rather than two independent loops.
 */
export function sampleWave(
  config: WaveConfig,
  time: number,
  reduced: boolean,
): WaveSample {
  if (reduced) {
    return { z: 0, turnX: 0, turnY: 0 };
  }

  const angle = (time * Math.PI * 2) / config.period + config.phase;

  return {
    z: Math.sin(angle) * config.amplitude,
    turnX: Math.cos(angle) * config.turn,
    turnY: Math.sin(angle + 0.9) * config.turn * 0.7,
  };
}

export type ShadowLift = {
  scale: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
};

/**
 * A prop at `lift` +1 is closest to the camera: its shadow spreads, fades and
 * slides lower-right. At -1 the shadow tightens, darkens and returns toward
 * the prop. Lift is clamped so a stray sample cannot invert the treatment.
 */
export function shadowForLift(lift: number, baseOpacity: number): ShadowLift {
  const clamped = Math.max(-1, Math.min(1, lift));
  const offsetX = clamped * SHADOW_LIFT_OFFSET;

  return {
    scale: 1 + clamped * SHADOW_LIFT_SCALE,
    opacity: baseOpacity * (1 - clamped * SHADOW_LIFT_FADE),
    offsetX,
    // At rest the offset is zero, not a signed zero; the difference matters to
    // equality tests and to any serialized debug output.
    offsetY: offsetX === 0 ? 0 : -offsetX,
  };
}
