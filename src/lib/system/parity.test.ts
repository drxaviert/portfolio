import { describe, expect, it } from "vitest";
import { parseColor } from "@/lib/system/color";
import type { Rgba } from "@/lib/system/color";
import { oracleTokens } from "@/lib/system/css-oracle";
import { derive } from "@/lib/system/derive";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import type { Phase } from "@/lib/theme";

const CASES: Array<[Phase, number]> = [
  ["dawn", 0],
  ["day", 1 / 3],
  ["dusk", 2 / 3],
  ["night", 1],
];

function colourOf(value: string): Rgba | null {
  try {
    return parseColor(value);
  } catch {
    return null;
  }
}

/**
 * A structural form for gradients and shadows: colours become 8-bit sentinels,
 * rem becomes px, and whitespace/punctuation is collapsed so `rgb(96 168 226 /
 * 0.75)` and `rgba(96, 168, 226, 0.75)` compare equal.
 */
function canonical(value: string): string {
  return value
    .replace(/(\d*\.?\d+)rem\b/g, (_match, number: string) => {
      return `${Number((Number(number) * 16).toFixed(3))}px`;
    })
    .replace(
      /(#[0-9a-f]{3,8}\b|(?:rgb|rgba|oklch)\([^)]*\))/gi,
      (match) => {
        const colour = parseColor(match);

        return `[${Math.round(colour.r)},${Math.round(colour.g)},${Math.round(colour.b)},${colour.a.toFixed(3)}]`;
      },
    )
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim();
}

describe("defaults equal globals.css", () => {
  it.each(CASES)("matches every token for %s", (phase, tod) => {
    const oracle = oracleTokens(phase);
    const derived = derive(DEFAULT_PARAMS, tod);

    expect(Object.keys(derived).sort()).toEqual(Object.keys(oracle).sort());

    for (const [name, oracleValue] of Object.entries(oracle)) {
      const derivedValue = derived[name];

      expect(derivedValue, `${phase} ${name}`).toBeDefined();

      const oracleColour = colourOf(oracleValue);
      const derivedColour = colourOf(derivedValue);

      if (oracleColour && derivedColour) {
        expect(
          Math.abs(derivedColour.r - oracleColour.r),
          `${phase} ${name} r`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(derivedColour.g - oracleColour.g),
          `${phase} ${name} g`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(derivedColour.b - oracleColour.b),
          `${phase} ${name} b`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(derivedColour.a - oracleColour.a),
          `${phase} ${name} a`,
        ).toBeLessThanOrEqual(0.01);
      } else {
        expect(canonical(derivedValue), `${phase} ${name}`).toBe(
          canonical(oracleValue),
        );
      }
    }
  });
});
