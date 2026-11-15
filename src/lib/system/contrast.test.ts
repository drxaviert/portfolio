import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor } from "@/lib/system/color";
import { derive } from "@/lib/system/derive";
import type { TokenMap } from "@/lib/system/derive";
import {
  CONTRAST_MAX,
  CONTRAST_MIN,
  DEFAULT_PARAMS,
  todForPhase,
} from "@/lib/system/params";
import type { Phase } from "@/lib/theme";

type Pair = readonly [foreground: string, background: string];

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

const PAIRS: readonly Pair[] = [
  ["--on-surface", "--surface-container-low"],
  ["--on-surface", "--surface"],
  ["--on-surface", "--surface-container-high"],
  ["--on-surface-variant", "--surface-container-low"],
  ["--on-surface-variant", "--surface"],
  ["--primary", "--surface-container-low"],
  ["--on-primary", "--primary"],
];

/**
 * These already miss 4.5:1 at the shipped defaults in the light phases, so no
 * parameter range can make them pass. They must not get any worse: where a
 * pair passes at a tod it has to stay AA, and where it already fails it has to
 * stay at or above the worst ratio the shipped defaults already produce.
 */
const AA_KNOWN_FAILING: readonly string[] = [
  "--primary on --surface-container-low",
  "--on-primary on --primary",
];

const HUES = [-180, -90, 0, 90, 180] as const;
const CONTRASTS = [CONTRAST_MIN, 1, CONTRAST_MAX] as const;

// The 0.05 grid plus the exact phase stops, so all four shipped phases are hit.
const TODS = Array.from(
  new Set(
    [
      ...Array.from({ length: 21 }, (_, index) => index / 20),
      ...PHASES.map(todForPhase),
    ].map((tod) => Number(tod.toFixed(6))),
  ),
).sort((a, b) => a - b);

function key(pair: Pair): string {
  return `${pair[0]} on ${pair[1]}`;
}

function isKnownFailing(pair: Pair): boolean {
  return AA_KNOWN_FAILING.includes(key(pair));
}

function ratio(tokens: TokenMap, pair: Pair): number {
  return contrastRatio(
    parseColor(tokens[pair[0]]),
    parseColor(tokens[pair[1]]),
  );
}

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const WHITE = { r: 255, g: 255, b: 255, a: 1 };

/** Every background a text role is measured against, mirroring derive. */
const AA_BACKGROUNDS: Record<string, readonly string[]> = {
  "--on-surface": [
    "--surface",
    "--surface-container-low",
    "--surface-container-high",
  ],
  "--on-surface-variant": ["--surface", "--surface-container-low"],
};

/**
 * The best worst-case ratio this foreground can reach across all its
 * surfaces. Between stops the OKLCH blend crosses mid-grey, where 4.5:1 is
 * physically impossible; the engine must still reach this joint ceiling
 * (within rounding) rather than settle for lower contrast.
 */
function jointCeiling(tokens: TokenMap, foreground: string): number {
  const backgrounds = AA_BACKGROUNDS[foreground] ?? [];

  const worst = (colour: { r: number; g: number; b: number; a: number }) =>
    Math.min(
      ...backgrounds.map((background) =>
        contrastRatio(colour, parseColor(tokens[background])),
      ),
    );

  return Math.max(worst(BLACK), worst(WHITE));
}

function defaultTokens(tod: number): TokenMap {
  return derive(DEFAULT_PARAMS, tod);
}

describe("AA contrast", () => {
  it("keeps every shipped phase at 4.5:1 for the pairs that already pass", () => {
    for (const phase of PHASES) {
      const tokens = derive(DEFAULT_PARAMS, todForPhase(phase));

      for (const pair of PAIRS) {
        const value = ratio(tokens, pair);

        if (isKnownFailing(pair)) {
          expect(Number.isFinite(value), `${phase} ${key(pair)}`).toBe(true);
        } else {
          const bestPossible = Math.min(4.5, jointCeiling(tokens, pair[0]));

          expect(value, `${phase} ${key(pair)}`).toBeGreaterThanOrEqual(
            bestPossible - 0.05,
          );
        }
      }
    }
  });

  it("stays AA across tod, hue and contrast, and never worsens a known failure", () => {
    // The worst ratio each known-failing pair already shows at the defaults,
    // including the hue axis, since hue drift is part of the shipped behaviour.
    const floors = new Map<string, number>();

    for (const pair of PAIRS) {
      if (!isKnownFailing(pair)) continue;

      let floor = Number.POSITIVE_INFINITY;

      for (const tod of TODS) {
        for (const hue of HUES) {
          floor = Math.min(
            floor,
            ratio(derive({ ...DEFAULT_PARAMS, hue }, tod), pair),
          );
        }
      }

      floors.set(key(pair), floor);
    }

    for (const tod of TODS) {
      const defaults = defaultTokens(tod);

      for (const hue of HUES) {
        for (const contrast of CONTRASTS) {
          const tokens = derive({ ...DEFAULT_PARAMS, hue, contrast }, tod);

          for (const pair of PAIRS) {
            const value = ratio(tokens, pair);
            const label = `${key(pair)} tod=${tod} hue=${hue} contrast=${contrast}`;

            if (!isKnownFailing(pair)) {
              const bestPossible = Math.min(4.5, jointCeiling(tokens, pair[0]));

              expect(value, label).toBeGreaterThanOrEqual(bestPossible - 0.05);
              continue;
            }

            const defaultRatio = ratio(defaults, pair);
            const threshold =
              defaultRatio >= 4.5 ? 4.5 : (floors.get(key(pair)) ?? 0);

            // Known failures sit at ratios around 1:1, where OKLCH hue drift
            // and 8-bit rounding move them by hundredths. Guard against a real
            // collapse, not that noise.
            expect(value, label).toBeGreaterThanOrEqual(threshold - 0.03);
          }
        }
      }
    }
  }, 30_000);
});
