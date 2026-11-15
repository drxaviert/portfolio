import { parseColor } from "@/lib/system/color";
import type { TokenMap } from "@/lib/system/derive";
import type { SystemEngine } from "@/lib/system/engine";

/**
 * The horizon uniforms the engine can change: the gradient stops and the two
 * blob tints. Blob geometry and blur stay CSS tokens — the engine does not
 * derive them, and they only change on resize.
 */
export type HorizonUniforms = {
  base: [number, number, number];
  mid: [number, number, number];
  horizon3: [number, number, number];
  midAt: number;
  color1: [number, number, number];
  color2: [number, number, number];
  alpha1: number;
  alpha2: number;
};

function channels(
  value: string | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  if (!value) return fallback;

  try {
    const { r, g, b } = parseColor(value);

    return [r / 255, g / 255, b / 255];
  } catch {
    return fallback;
  }
}

function numberToken(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `--horizon-mid-at` is a CSS percentage; the shader wants 0..1. */
function percentToken(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const percent = value.trim().endsWith("%");

  return percent
    ? numberToken(value, fallback * 100) / 100
    : numberToken(value, fallback);
}

/** The derived token map as the shader's uniform block. */
export function uniformsFromTokens(tokens: TokenMap): HorizonUniforms {
  return {
    base: channels(tokens["--horizon-base"], [0, 0, 0]),
    mid: channels(tokens["--horizon-mid"], [0, 0, 0]),
    horizon3: channels(tokens["--horizon-3"], [0, 0, 0]),
    midAt: percentToken(tokens["--horizon-mid-at"], 0.82),
    color1: channels(tokens["--horizon-1"], [0, 0, 0]),
    color2: channels(tokens["--horizon-2"], [0, 0, 0]),
    alpha1: numberToken(tokens["--horizon-1-alpha"], 0.06),
    alpha2: numberToken(tokens["--horizon-2-alpha"], 0.06),
  };
}

/**
 * Follows the engine without a React render: the engine can notify several
 * times in a frame (a drag updates params and the theme can move), so the last
 * token map wins and one rAF delivers it to the shader. Returning the function
 * unsubscribes and drops any frame that has not run yet.
 */
export function bindHorizonToEngine(
  engine: SystemEngine,
  apply: (uniforms: HorizonUniforms) => void,
): () => void {
  let pending: HorizonUniforms | null = null;
  let frame: number | null = null;
  let active = true;

  const flush = (): void => {
    frame = null;

    if (!active || pending === null) return;

    const uniforms = pending;

    pending = null;
    apply(uniforms);
  };

  const unsubscribe = engine.subscribe((tokens) => {
    pending = uniformsFromTokens(tokens);

    if (frame === null) frame = window.requestAnimationFrame(flush);
  });

  return () => {
    active = false;

    if (frame !== null) window.cancelAnimationFrame(frame);

    frame = null;
    pending = null;
    unsubscribe();
  };
}
