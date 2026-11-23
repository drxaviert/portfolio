/**
 * Idle breathing for the plane grid.
 *
 * The whole tile breathes around its centre: the mesh scale is
 *
 *   1 + amplitude * sin(2π t / period - (col + row) * wave)
 *
 * The phase is keyed to the plane's grid column and row, not its wrapped
 * screen position, so a plane that crosses the wrap seam keeps the same phase.
 * The amplitude is enveloped separately and keyed to the idle clock, so it can
 * fade to 0 while moving without touching the phase.
 */

export type BreathSettings = {
  /** Fraction of the tile size, e.g. 0.03 for ±3%. */
  amplitude: number;
  periodMs: number;
};

export type BreathConfig = {
  periodMs: number;
  amplitude: number;
  /** Phase offset per grid step; col and row share it, so the wave runs diagonally. */
  waveRadians: number;
  /** Time the canvas must be settled before the amplitude starts back in. */
  idleDelayMs: number;
  /** Time the amplitude takes to reach full after the idle delay. */
  fadeMs: number;
  /** Fast fade to 0 when the canvas starts moving. */
  fadeOutMs: number;
  /** Speed (px per 60fps frame) below which the canvas counts as settled. */
  settleSpeed: number;
};

export const BREATH = {
  periodMs: 5000,
  amplitude: 0.03,
  waveRadians: 0.6,
  idleDelayMs: 1000,
  fadeMs: 1200,
  fadeOutMs: 300,
  settleSpeed: 0.1,
  /** Cap the render loop at 30fps when breathing is the only motion. */
  frameMs: 1000 / 30,
  minAmplitude: 0,
  maxAmplitude: 0.06,
  minPeriodMs: 2000,
  maxPeriodMs: 10000,
} as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function breathPhase(
  timeMs: number,
  col: number,
  row: number,
  config: Pick<BreathConfig, "periodMs" | "waveRadians">,
): number {
  return (
    (timeMs / config.periodMs) * Math.PI * 2 - (col + row) * config.waveRadians
  );
}

/** The mesh scale multiplier at a point in time, before the envelope. */
export function breathScale(
  timeMs: number,
  col: number,
  row: number,
  config: BreathConfig,
): number {
  return 1 + config.amplitude * Math.sin(breathPhase(timeMs, col, row, config));
}

/**
 * Ease the amplitude in after the canvas has been settled for idleDelayMs.
 * Moving, a disabled loop, or reduced motion keep it at exactly 0.
 */
export function breathEnvelope(
  idleMs: number,
  {
    moving,
    enabled,
    reduced,
    config,
  }: {
    moving: boolean;
    enabled: boolean;
    reduced: boolean;
    config: BreathConfig;
  },
): number {
  if (!enabled || moving || reduced) return 0;

  const t = clamp01((idleMs - config.idleDelayMs) / config.fadeMs);

  return t * t * (3 - 2 * t);
}

/**
 * Ease the applied level toward its target. The target curve handles the slow
 * fade-in; a move starts a fast fade-out so the tiles settle without a snap.
 */
export function easeBreathLevel(
  level: number,
  target: number,
  dtMs: number,
  config: BreathConfig,
): number {
  if (target >= level) return target;

  const ease = 1 - Math.pow(0.001, Math.max(0, dtMs) / config.fadeOutMs);
  const next = level + (target - level) * ease;

  return Math.abs(next - target) < 0.001 ? target : next;
}
