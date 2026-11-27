/**
 * The reference playground's intro timeline, read from its bundle.
 *
 * Times are milliseconds from the first frame where the posters are ready.
 * The intro is a one-time entrance, so the long durations are deliberate.
 */
export const INTRO = {
  cameraDelayMs: 1300,
  cameraDurationMs: 2000,
  cameraFromZ: 700,
  cameraToZ: 500,
  gapDelayMs: 1500,
  gapDurationMs: 2000,
  /** Per-plane opacity starts at a deterministic delay in this range. */
  opacityDelayMinMs: 500,
  opacityDelayMaxMs: 1250,
  opacityDurationMs: 2000,
  /** Each tile starts this from its own opacity delay and colourises in 900ms. */
  grayDurationMs: 900,
  zoomDelayMs: 1250,
  zoomDurationMs: 2250,
  /** The bundle only says "settle"; 1.3 reads as a gentle push in. */
  zoomFrom: 1.3,
  /** Last tween to finish: the texture zoom, 1250 + 2250. */
  endMs: 3500,
  /** Visible videos start as soon as the poster load releases the intro clock. */
  videoStartMs: 0,
  /** Reduced motion: no camera/grid motion, just a short opacity fade. */
  reducedFadeMs: 200,
} as const;

export type Ease = (t: number) => number;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function power3Out(t: number): number {
  const x = clamp01(t);

  return 1 - Math.pow(1 - x, 3);
}

export function power3InOut(t: number): number {
  const x = clamp01(t);

  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function power4InOut(t: number): number {
  const x = clamp01(t);

  return x < 0.5
    ? 8 * x * x * x * x
    : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function introSegment(
  elapsedMs: number,
  delayMs: number,
  durationMs: number,
  ease: Ease,
): number {
  return ease(clamp01((elapsedMs - delayMs) / durationMs));
}

export function introCameraZ(elapsedMs: number): number {
  return lerp(
    INTRO.cameraFromZ,
    INTRO.cameraToZ,
    introSegment(
      elapsedMs,
      INTRO.cameraDelayMs,
      INTRO.cameraDurationMs,
      power4InOut,
    ),
  );
}

export function introGapProgress(elapsedMs: number): number {
  return introSegment(
    elapsedMs,
    INTRO.gapDelayMs,
    INTRO.gapDurationMs,
    power4InOut,
  );
}

export function introPlaneOpacity(
  elapsedMs: number,
  delayMs: number,
): number {
  return introSegment(
    elapsedMs,
    delayMs,
    INTRO.opacityDurationMs,
    power3Out,
  );
}

/**
 * One tile's grayscale, 1 -> 0, starting at the same delay as its opacity
 * fade. The tile is fully grey when it first becomes visible and blooms into
 * colour over 900ms power3.out while the 2s opacity fade is still running.
 */
export function introGray(elapsedMs: number, delayMs: number): number {
  return (
    1 -
    introSegment(elapsedMs, delayMs, INTRO.grayDurationMs, power3Out)
  );
}

export function introZoom(elapsedMs: number): number {
  return lerp(
    INTRO.zoomFrom,
    1,
    introSegment(
      elapsedMs,
      INTRO.zoomDelayMs,
      INTRO.zoomDurationMs,
      power3InOut,
    ),
  );
}

export function introEnded(elapsedMs: number): boolean {
  return elapsedMs >= INTRO.endMs;
}

export function introVideosReady(elapsedMs: number): boolean {
  return elapsedMs >= INTRO.videoStartMs;
}

/** Reduced motion skips the movement and keeps only a 200ms opacity fade. */
export function reducedOpacity(elapsedMs: number): number {
  return clamp01(elapsedMs / INTRO.reducedFadeMs);
}

export function reducedIntroEnded(elapsedMs: number): boolean {
  return elapsedMs >= INTRO.reducedFadeMs;
}
