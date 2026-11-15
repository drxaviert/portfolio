import type { Phase } from "@/lib/theme";
import {
  blendOklch,
  contrastRatio,
  fromOklch,
  parseColor,
  rotateHue,
  toCss,
  toOklch,
} from "@/lib/system/color";
import type { Rgba } from "@/lib/system/color";
import { clampParams } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";
import {
  DURATIONS,
  EASES,
  PALETTE,
  RADII,
  ROLES,
} from "@/lib/system/source.generated";

/** Custom property name -> resolved output value (hex / rgba / px / ms / s / …). */
export type TokenMap = Record<string, string>;

/** 0..1; 0 dawn, 1/3 day, 2/3 dusk, 1 night. */
export type TodPosition = number;

const STOPS: ReadonlyArray<{ phase: Phase; tod: number }> = [
  { phase: "dawn", tod: 0 },
  { phase: "day", tod: 1 / 3 },
  { phase: "dusk", tod: 2 / 3 },
  { phase: "night", tod: 1 },
];

const STOP_EPSILON = 1e-6;
const VAR_PATTERN = /var\(\s*(--[\w-]+)\s*\)/g;
const COLOUR_PATTERN =
  /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|(?:rgb|rgba|oklch)\([^)]*\)/gi;
const NUMBER_PATTERN = /^(-?\d*\.?\d+)(%|px|ms|s)?$/;
const PILL_RADIUS = 9999;
// Search slightly above the floor so 8-bit output rounding cannot land under it.
const AA_SEARCH_RATIO = 4.55;

/**
 * The pairs that pass in the shipped CSS. Between phase stops an OKLCH blend
 * crosses light→dark through mid-grey, where even on-surface cannot reach
 * 4.5:1 against every surface at once. Derive therefore picks the lightness
 * that maximises the worst of these backgrounds. The brand pairs (`--primary`
 * as text and `--on-primary` on `--primary`) cannot reach AA without changing
 * primary's colour, so they are left as shipped and tracked in tests.
 */
const AA_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "--on-surface",
    ["--surface", "--surface-container-low", "--surface-container-high"],
  ],
  ["--on-surface-variant", ["--surface", "--surface-container-low"]],
];

/**
 * Which role each on-* role and surface* role is measured against for the
 * contrast parameter. On-surface variants sit on the plain surface.
 */
const SURFACE_PARTNERS = new Map<string, string>();

for (const token of Object.keys(ROLES.day)) {
  if (token === "--surface") continue;
  if (token.startsWith("--surface")) SURFACE_PARTNERS.set(token, "--surface");
}

SURFACE_PARTNERS.set("--on-surface", "--surface");
SURFACE_PARTNERS.set("--on-surface-variant", "--surface");
SURFACE_PARTNERS.set("--on-primary", "--primary");

/** Night only once the Dusk→Night segment has passed its midpoint. */
export function phaseAtTod(tod: TodPosition): Phase {
  if (tod > 5 / 6) return "night";
  if (tod >= 2 / 3) return "dusk";
  if (tod >= 1 / 3) return "day";

  return "dawn";
}

function colourOf(value: string): Rgba | null {
  try {
    return parseColor(value);
  } catch {
    return null;
  }
}

function serialiseColours(value: string): string {
  return value.replace(COLOUR_PATTERN, (match) => toCss(parseColor(match)));
}

/**
 * Rotates every colour literal in a token value, weighted by the OKLCH chroma
 * smoothstep from Task 1. Near-neutrals are returned untouched so a hue change
 * cannot nudge a neutral partner by a rounding step.
 */
export function rotateTokenColour(value: string, deg: number): string {
  return value.replace(COLOUR_PATTERN, (match) => {
    const oklch = toOklch(parseColor(match));

    if (oklch.c <= 0.01) return match;

    return toCss(fromOklch(rotateHue(oklch, deg)));
  });
}

function formatNumber(value: number): string {
  return `${Number(value.toFixed(3))}`;
}

export function scaleRadius(value: string, round: number): string {
  const match = value.match(/^(-?\d*\.?\d+)px$/);

  if (!match) return value;

  const px = Number(match[1]);

  // Zero and pill keep their geometry; roundness only multiplies finite radii.
  if (!Number.isFinite(px) || px === 0 || px === PILL_RADIUS) return value;

  return `${formatNumber(px * round)}px`;
}

export function scaleDuration(value: string, speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0) return value;

  const match = value.match(/^(-?\d*\.?\d+)(ms|s)$/);

  if (!match) return value;

  return `${formatNumber(Number(match[1]) / speed)}${match[2]}`;
}

function resolveReferences(
  value: string,
  roles: Record<string, string>,
): string {
  let result = value;

  for (let pass = 0; pass < 20 && result.includes("var("); pass += 1) {
    result = result.replace(VAR_PATTERN, (_match, name: string) => {
      const role = roles[name];

      if (role !== undefined) return role;

      const palette = PALETTE[name];

      if (palette !== undefined) return palette;

      throw new Error(`derive: unresolved var(${name})`);
    });
  }

  return result;
}

function resolvedRoles(phase: Phase): Record<string, string> {
  const roles = ROLES[phase];
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(roles)) {
    result[name] = resolveReferences(value, roles);
  }

  return result;
}

function blendValue(a: string, b: string, t: number): string {
  if (a === b) return a;

  const colourA = colourOf(a);
  const colourB = colourOf(b);

  if (colourA && colourB) {
    return toCss(
      fromOklch(blendOklch(toOklch(colourA), toOklch(colourB), t)),
    );
  }

  const numberA = a.match(NUMBER_PATTERN);
  const numberB = b.match(NUMBER_PATTERN);

  if (numberA && numberB && (numberA[2] ?? "") === (numberB[2] ?? "")) {
    const value =
      Number(numberA[1]) + (Number(numberB[1]) - Number(numberA[1])) * t;

    return `${Number(value.toFixed(4))}${numberA[2] ?? ""}`;
  }

  // Gradients and shadows have no defined per-stop blend yet; the nearest
  // segment wins so the output stays a real token rather than a hybrid string.
  return t < 0.5 ? a : b;
}

function rolesAt(tod: number): Record<string, string> {
  const stop = STOPS.find((entry) => Math.abs(tod - entry.tod) < STOP_EPSILON);

  if (stop) return resolvedRoles(stop.phase);

  const index = tod < 1 / 3 ? 0 : tod < 2 / 3 ? 1 : 2;
  const from = STOPS[index];
  const to = STOPS[index + 1];
  const t = (tod - from.tod) / (to.tod - from.tod);
  const a = resolvedRoles(from.phase);
  const b = resolvedRoles(to.phase);
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(a)) {
    result[name] = blendValue(value, b[name] ?? value, t);
  }

  return result;
}

function remToPx(value: string): string {
  const match = value.match(/^(-?\d*\.?\d+)rem$/);

  if (!match) return value;

  return `${Number((Number(match[1]) * 16).toFixed(4))}px`;
}

function resolveDuration(value: string): string {
  let result = value;

  for (let pass = 0; pass < 10 && result.includes("var("); pass += 1) {
    result = result.replace(VAR_PATTERN, (_match, name: string) => {
      const duration = DURATIONS[name];

      if (duration === undefined) {
        throw new Error(`derive: unresolved duration var(${name})`);
      }

      return duration;
    });
  }

  return result;
}

/** The defaults-only token map (Task 2's output) for a tod position. */
function buildBase(tod: number): TokenMap {
  const roles = rolesAt(tod);
  const tokens: TokenMap = {};

  for (const [name, value] of Object.entries(PALETTE)) {
    tokens[name] = serialiseColours(value);
  }

  for (const [name, value] of Object.entries(RADII)) {
    tokens[name] = remToPx(value);
  }

  for (const [name, value] of Object.entries(DURATIONS)) {
    tokens[name] = resolveDuration(value);
  }

  for (const [name, value] of Object.entries(EASES)) {
    tokens[name] = value;
  }

  const serialisedRoles: TokenMap = {};

  for (const [name, value] of Object.entries(roles)) {
    serialisedRoles[name] = serialiseColours(value);
  }

  Object.assign(tokens, serialisedRoles);

  // Composed from the resolved orb stops so the engine never writes a token
  // that still references another custom property.
  tokens["--orb-gradient"] =
    `linear-gradient(45deg, ${serialisedRoles["--orb-1"]} 0%, ` +
    `${serialisedRoles["--orb-2"]} ${serialisedRoles["--orb-2-at"]}, ` +
    `${serialisedRoles["--orb-3"]} 100%)`;

  return tokens;
}

/**
 * Contrast scales the default OKLCH L distance of each surface* role from
 * `--surface`, and of each on-* role from its surface partner. The reference
 * is always the shipped distance (`base`), so hue rotation cannot compound it.
 */
function applyContrast(
  tokens: TokenMap,
  base: TokenMap,
  contrast: number,
): void {
  for (const [token, partner] of SURFACE_PARTNERS) {
    const role = colourOf(base[token]);
    const partnerColour = colourOf(base[partner]);

    if (!role || !partnerColour) continue;

    const oklch = toOklch(role);
    const partnerL = toOklch(partnerColour).l;
    const l = Math.min(
      1,
      Math.max(0, partnerL + (oklch.l - partnerL) * contrast),
    );

    tokens[token] = toCss(fromOklch({ ...oklch, l }));
  }
}

/** Lifts a text/icon role to the most legible lightness its surfaces allow. */
function enforceAa(tokens: TokenMap): void {
  for (const [foreground, backgrounds] of AA_GROUPS) {
    const fgColour = colourOf(tokens[foreground]);

    if (!fgColour) continue;

    const bgColours = backgrounds
      .map((background) => colourOf(tokens[background]))
      .filter((colour): colour is Rgba => colour !== null);

    if (bgColours.length === 0) continue;

    const worstOf = (colour: Rgba) =>
      Math.min(...bgColours.map((bg) => contrastRatio(colour, bg)));

    if (worstOf(fgColour) >= AA_SEARCH_RATIO) continue;

    const oklch = toOklch(fgColour);
    let bestL = oklch.l;
    let bestWorst = worstOf(fgColour);

    // A single foreground serves several surfaces; choose the L that lifts
    // the worst of them, so no background is sacrificed for another.
    for (let step = 0; step <= 100; step += 1) {
      const candidate = fromOklch({ ...oklch, l: step / 100 });
      const worst = worstOf(candidate);

      if (worst > bestWorst + 1e-6) {
        bestL = step / 100;
        bestWorst = worst;
      }
    }

    if (bestL !== oklch.l) {
      tokens[foreground] = toCss(fromOklch({ ...oklch, l: bestL }));
    }
  }
}

export function derive(params: Params, siteBlend: TodPosition): TokenMap {
  const safe = clampParams(params);
  const tod = Math.min(1, Math.max(0, siteBlend));
  const base = buildBase(tod);
  const atStop = STOPS.some((entry) => Math.abs(tod - entry.tod) < STOP_EPSILON);

  const defaultOtherParams =
    safe.hue === 0 &&
    safe.round === 1 &&
    safe.contrast === 1 &&
    safe.speed === 1;

  // Defaults stay byte-exact: no OKLCH round trip anywhere on the stop path.
  if (defaultOtherParams && atStop) return base;

  const tokens: TokenMap = { ...base };

  if (safe.contrast !== 1) applyContrast(tokens, base, safe.contrast);

  if (safe.hue !== 0) {
    for (const [name, value] of Object.entries(tokens)) {
      tokens[name] = rotateTokenColour(value, safe.hue);
    }
  }

  enforceAa(tokens);

  if (safe.round !== 1) {
    for (const name of Object.keys(RADII)) {
      tokens[name] = scaleRadius(base[name], safe.round);
    }
  }

  if (safe.speed !== 1) {
    for (const name of Object.keys(DURATIONS)) {
      tokens[name] = scaleDuration(base[name], safe.speed);
    }
  }

  return tokens;
}
