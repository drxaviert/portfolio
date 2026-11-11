export type FiberFanSettings = {
  /** Number of strands in the fan. */
  strandCount: number;
  /** Total spread of the fan, in degrees, measured across the top. */
  fanAngle: number;
  /** Strength of the base glow behind the strands. */
  glowStrength: number;
  /** Distance from the pointer at which the push starts to fall off, in px. */
  pushRadius: number;
  /** Maximum sideways displacement of a strand at the centre of the push. */
  pushStrength: number;
  /** Spring stiffness for the strand return (higher = snappier). */
  stiffness: number;
  /** Spring damping for the strand return (higher = less wobble). */
  damping: number;
};

/**
 * Tuned on /dev/play-card. The fan is deliberately dense: a few hundred
 * one-pixel strands read as light rather than as individual lines.
 */
export const FIBER_FAN_DEFAULTS: FiberFanSettings = {
  strandCount: 560,
  fanAngle: 168,
  glowStrength: 0.45,
  pushRadius: 120,
  pushStrength: 80,
  stiffness: 180,
  damping: 16,
};
