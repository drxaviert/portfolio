/**
 * Full-screen globe/orb lens.
 *
 * The post-pass samples a larger-than-viewport render target: the screen point
 * q (NDC) maps to the source point
 *
 *   t = q * sourceScale * (1 + k * (r / rMax)^2)
 *
 * where r is the aspect-corrected radius and rMax is the corner radius. The
 * centre is 1:1 with the flat view; the edges sample further out, so the
 * content compresses toward the rim like a barrel/fisheye lens. The 30% source
 * margin keeps every sample inside the target for k up to 0.5, with no black
 * corners.
 */

export type LensMode = "flat" | "globe";

export const LENS = {
  /** Render target margin on each side, as a share of the viewport. */
  margin: 0.3,
  /** The viewport occupies this share of the target's NDC. */
  sourceScale: 1 / 1.6,
  defaultMode: "globe" as LensMode,
  /** The owner's tuned globe. */
  defaultStrength: 0.23,
  /** Added on top of the base at a fast drag; the owner's full lift. */
  defaultBoost: 0.3,
  defaultVignette: 0.25,
  maxStrength: 0.5,
  maxBoost: 0.3,
  maxVignette: 0.25,
  /** Pan speed (px/frame) that reaches the full drag boost. */
  boostSpeed: 8,
  /** Strength easing per 60fps frame. */
  easePerFrame: 0.08,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep01(value: number): number {
  const t = clamp(value, 0, 1);

  return t * t * (3 - 2 * t);
}

/** The aspect-corrected radius of a screen NDC point, normalised to 0..1. */
export function lensRadius(x: number, y: number, aspect: number): number {
  return Math.hypot(x * aspect, y) / Math.hypot(aspect, 1);
}

/** Screen NDC -> render-target NDC, matching the post shader. */
export function lensProject(
  x: number,
  y: number,
  strength: number,
  aspect: number,
): { x: number; y: number } {
  const k = clamp(strength, 0, LENS.maxStrength);
  const r = lensRadius(x, y, aspect);
  const f = 1 + k * r * r;

  return {
    x: x * LENS.sourceScale * f,
    y: y * LENS.sourceScale * f,
  };
}

/** Render-target NDC -> screen NDC. Used for tests and round-trips. */
export function lensUnproject(
  x: number,
  y: number,
  strength: number,
  aspect: number,
): { x: number; y: number } {
  const k = clamp(strength, 0, LENS.maxStrength);
  const tx = x * aspect;
  const ty = y;
  const v = Math.hypot(tx, ty);

  if (v < 1e-9) return { x: 0, y: 0 };

  // v = rMax * sourceScale * (r + k * r^3); r is monotonic for k >= 0.
  const rMax = Math.hypot(aspect, 1);
  let lo = 0;
  let hi = 4;

  for (let i = 0; i < 32; i += 1) {
    const mid = (lo + hi) / 2;
    const value = rMax * LENS.sourceScale * (mid + k * mid * mid * mid);

    if (value < v) lo = mid;
    else hi = mid;
  }

  const r = (lo + hi) / 2;
  const qa = (r * rMax) / v;

  return {
    x: (tx * qa) / aspect,
    y: ty * qa,
  };
}

/** The target strength for a mode, base, boost and current pan speed. */
export function lensTargetStrength({
  mode,
  base,
  boost,
  speed,
  reduced,
}: {
  mode: LensMode;
  base: number;
  boost: number;
  speed: number;
  reduced: boolean;
}): number {
  if (mode !== "globe") return 0;

  const clampedBase = clamp(base, 0, LENS.maxStrength);
  if (reduced) return clampedBase;

  const boostAmount =
    clamp(boost, 0, LENS.maxBoost) * smoothstep01(speed / LENS.boostSpeed);

  return clamp(clampedBase + boostAmount, 0, LENS.maxStrength);
}
