import type { Phase } from "@/lib/theme";
import { blendOklch, fromOklch, parseColor, toCss, toOklch } from "@/lib/system/color";
import type { Rgba } from "@/lib/system/color";
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
    const value = Number(numberA[1]) + (Number(numberB[1]) - Number(numberA[1])) * t;

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

export function derive(params: Params, siteBlend: TodPosition): TokenMap {
  const tod = Math.min(1, Math.max(0, siteBlend));
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

  // Task 3 applies hue, contrast, roundness and speed; Task 2 is defaults-only.
  void params;

  return tokens;
}
