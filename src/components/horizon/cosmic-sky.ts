/**
 * Pure logic for the cosmic sky: the top-half layer that shows faint stars at
 * night and a pale aurora by day while the horizon is listening.
 *
 * Everything here is deterministic and DOM-free so the phase mapping, the band
 * mapping and the star pool can be unit tested. The canvas lives in
 * cosmic-sky.tsx.
 */

export type SkyPhase = "day" | "dawn" | "dusk" | "night";
export type SkyPhaseOverride = SkyPhase | "auto";

export const SKY_PHASES: readonly SkyPhase[] = [
  "day",
  "dawn",
  "dusk",
  "night",
];

export type SkyStrengths = { stars: number; aurora: number };

/**
 * How strong each layer is per phase. Night is stars, day is aurora; dusk
 * borrows the stars and dawn borrows the aurora at about 60%. Edit this to
 * change the mix.
 */
export const SKY_PHASE_PRESET: Record<SkyPhase, SkyStrengths> = {
  night: { stars: 1, aurora: 0 },
  dusk: { stars: 0.6, aurora: 0 },
  dawn: { stars: 0, aurora: 0.6 },
  day: { stars: 0, aurora: 1 },
};

export function parsePhase(value: string | null | undefined): SkyPhase {
  return value === "night" ||
    value === "dusk" ||
    value === "dawn" ||
    value === "day"
    ? value
    : "day";
}

export function resolvePhase(
  documentPhase: SkyPhase,
  override: SkyPhaseOverride,
): SkyPhase {
  return override === "auto" ? documentPhase : override;
}

/** Everything the panel can change; all plain numbers so sliders drive them. */
export type SkyTuning = {
  /** Multiplier on the star count (1 = about one star per 9000 px2). */
  starDensity: number;
  /** Multiplier on star alpha. */
  starBrightness: number;
  /** Multiplier on aurora alpha. */
  auroraOpacity: number;
  /** Multiplier on aurora sway / fold speed. */
  auroraSpeed: number;
  gainBass: number;
  gainMid: number;
  gainHigh: number;
  gainEnergy: number;
  phaseOverride: SkyPhaseOverride;
};

export const SKY_TUNING_DEFAULTS: SkyTuning = {
  starDensity: 1,
  starBrightness: 1,
  auroraOpacity: 1,
  auroraSpeed: 1,
  gainBass: 1,
  gainMid: 1,
  // The drone track barely reaches the high band, so lift it.
  gainHigh: 3,
  gainEnergy: 1,
  phaseOverride: "auto",
};

export const SKY_TUNING_RANGES = {
  starDensity: { min: 0, max: 2.5, step: 0.05 },
  starBrightness: { min: 0, max: 2, step: 0.05 },
  auroraOpacity: { min: 0, max: 2, step: 0.05 },
  auroraSpeed: { min: 0.25, max: 2.5, step: 0.05 },
  gainBass: { min: 0, max: 3, step: 0.05 },
  gainMid: { min: 0, max: 3, step: 0.05 },
  gainHigh: { min: 0, max: 6, step: 0.1 },
  gainEnergy: { min: 0, max: 3, step: 0.05 },
} as const;

export type SkyNumericKey = keyof typeof SKY_TUNING_RANGES;

export const SKY_NUMERIC_KEYS = Object.keys(
  SKY_TUNING_RANGES,
) as SkyNumericKey[];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Read a persisted tuning; unknown or malformed fields fall back to defaults. */
export function parseSkyTuning(raw: string | null): SkyTuning {
  const tuning = { ...SKY_TUNING_DEFAULTS };

  if (!raw) return tuning;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return tuning;
    }

    const record = parsed as Record<string, unknown>;

    for (const key of SKY_NUMERIC_KEYS) {
      const value = Number(record[key]);
      const range = SKY_TUNING_RANGES[key];

      if (record[key] !== undefined && Number.isFinite(value)) {
        tuning[key] = clamp(value, range.min, range.max);
      }
    }

    const phase = record.phaseOverride;

    if (
      phase === "auto" ||
      (SKY_PHASES as readonly unknown[]).includes(phase)
    ) {
      tuning.phaseOverride = phase as SkyPhaseOverride;
    }
  } catch {
    // Fall through to defaults.
  }

  return tuning;
}

export type SkyBands = {
  bass: number;
  mid: number;
  high: number;
  energy: number;
};

export type SkyReactivity = {
  /** Overall brightness multiplier, about 1..1.3. */
  lift: number;
  /** Star twinkle depth, 0..1. */
  twinkleDepth: number;
  /** Aurora brightness multiplier. */
  auroraBright: number;
  /** Aurora sway amplitude multiplier. */
  sway: number;
  /** Extra fine shimmer, 0..1. */
  shimmer: number;
};

export const TWINKLE_DEPTH_REST = 0.4;

/**
 * Map the smoothed bands onto the sky. All zeros give the resting values, so
 * the time-driven motion is the whole picture when nothing is playing and the
 * audio is only ever a light layer on top.
 */
export function mapBands(bands: SkyBands, tuning: SkyTuning): SkyReactivity {
  const bass = clamp(bands.bass * tuning.gainBass, 0, 1.5);
  const mid = clamp(bands.mid * tuning.gainMid, 0, 1.5);
  const high = clamp(bands.high * tuning.gainHigh, 0, 1);
  const energy = clamp(bands.energy * tuning.gainEnergy, 0, 1.5);

  return {
    lift: 1 + energy * 0.22,
    twinkleDepth: clamp(TWINKLE_DEPTH_REST + mid * 0.3 + high * 0.15, 0, 0.95),
    auroraBright: 1 + mid * 0.4,
    sway: 1 + bass * 0.7,
    shimmer: high,
  };
}

export const REST_REACTIVITY: SkyReactivity = {
  lift: 1,
  twinkleDepth: TWINKLE_DEPTH_REST,
  auroraBright: 1,
  sway: 1,
  shimmer: 0,
};

/** cubic-bezier(0.4, 0, 0.2, 1), the --ease-calm the listening swell uses. */
export function easeCalm(t: number): number {
  const x = clamp(t, 0, 1);
  const [x1, y1, x2, y2] = [0.4, 0, 0.2, 1];
  const axis = (a: number, b: number, s: number) =>
    3 * a * (1 - s) * (1 - s) * s + 3 * b * (1 - s) * s * s + s * s * s;
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;

    if (axis(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }

  return axis(y1, y2, (lo + hi) / 2);
}

/**
 * Move the listening progress toward its target at the preset's durations.
 * Progress is linear in time, so a reversal mid-swell retargets from where it
 * is with no jump; the eased value is what drives the picture.
 */
export function stepRamp(
  progress: number,
  listening: boolean,
  dt: number,
  inDuration: number,
  outDuration: number,
): number {
  const rate = listening ? 1 / inDuration : -1 / outDuration;

  return clamp(progress + rate * dt, 0, 1);
}

/** Same timings as the horizon listening swell (motion.md). */
export const SKY_RAMP = {
  inDuration: 3.5,
  outDuration: 1.2,
  reducedDuration: 0.4,
};

export type Star = {
  /** 0..1 across the layer; scaled by the layer's size, so a resize never re-seeds. */
  x: number;
  y: number;
  /** 0 far, 1 mid, 2 near. */
  layer: 0 | 1 | 2;
  /** CSS px radius. */
  radius: number;
  baseAlpha: number;
  period: number;
  phase: number;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Largest pool; the live count takes the first N, so density changes fade stars in and out. */
export const STAR_POOL_SIZE = 320;
/** One star per this many CSS px2 at density 1. */
export const STAR_AREA_PER_STAR = 9000;

/** Far layer is the most numerous and dimmest; near is rare and a touch larger. */
const LAYERS = [
  { share: 0.55, radius: [0.45, 0.65], alpha: [0.22, 0.4], drift: 0.2 },
  { share: 0.33, radius: [0.6, 0.85], alpha: [0.3, 0.55], drift: 0.5 },
  { share: 0.12, radius: [0.85, 1.15], alpha: [0.4, 0.7], drift: 1 },
] as const;

/** Fraction of the layer width per second at drift 1: a full lap in ~13 min. */
export const STAR_DRIFT_PER_SECOND = 1 / 800;

export function layerDrift(layer: 0 | 1 | 2): number {
  return LAYERS[layer].drift;
}

export function createStarPool(seed = 20251127): Star[] {
  const random = mulberry32(seed);
  const stars: Star[] = [];

  for (let i = 0; i < STAR_POOL_SIZE; i += 1) {
    const roll = random();
    const layer: 0 | 1 | 2 =
      roll < LAYERS[0].share
        ? 0
        : roll < LAYERS[0].share + LAYERS[1].share
          ? 1
          : 2;
    const spec = LAYERS[layer];
    const lerp = (range: readonly [number, number]) =>
      range[0] + (range[1] - range[0]) * random();

    stars.push({
      x: random(),
      y: random(),
      layer,
      radius: lerp(spec.radius),
      baseAlpha: lerp(spec.alpha),
      period: 4 + random() * 5,
      phase: random() * Math.PI * 2,
    });
  }

  return stars;
}

export function starCount(
  widthCss: number,
  heightCss: number,
  density: number,
): number {
  const raw = ((widthCss * heightCss) / STAR_AREA_PER_STAR) * density;

  return clamp(Math.round(raw), 0, STAR_POOL_SIZE);
}

/** Twinkle multiplier on alpha: 1 at the bright end, (1 - depth) at the dim end. */
export function twinkle(star: Star, t: number, depth: number): number {
  const wave =
    0.5 + 0.5 * Math.sin((t / star.period) * Math.PI * 2 + star.phase);

  return 1 - depth * (1 - wave);
}

export const SHOOTING_MIN_GAP = 40;
export const SHOOTING_MAX_GAP = 75;

/** Seconds until the next shooting star; never under the 40s floor. */
export function nextShootingGap(random: () => number): number {
  return SHOOTING_MIN_GAP + random() * (SHOOTING_MAX_GAP - SHOOTING_MIN_GAP);
}

/** Eased mask stops: opaque at the top, gone by the bottom, no hard edge. */
export function maskGradient(): string {
  const stops: string[] = [];
  const steps = 10;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const s = clamp((t - 0.2) / 0.8, 0, 1);
    const alpha = 1 - s * s * (3 - 2 * s);

    stops.push(`rgba(0,0,0,${alpha.toFixed(3)}) ${(t * 100).toFixed(0)}%`);
  }

  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}
