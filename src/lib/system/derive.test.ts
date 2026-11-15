import { describe, expect, it } from "vitest";
import { fromOklch, parseColor, toCss, toOklch } from "@/lib/system/color";
import {
  derive,
  phaseAtTod,
  rotateTokenColour,
  scaleRadius,
} from "@/lib/system/derive";
import { CONTRAST_MAX, CONTRAST_MIN, DEFAULT_PARAMS } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

const COLOUR_TOKENS =
  /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|(?:rgb|rgba|oklch)\([^)]*\)/gi;
const ALLOWED_COLOUR = /^(#[0-9a-f]{6}|rgba\([^)]*\))$/;

function tokens(overrides: Partial<Params>, tod = 1 / 3) {
  return derive({ ...DEFAULT_PARAMS, ...overrides }, tod);
}

function hueOf(css: string): number {
  return toOklch(parseColor(css)).h;
}

function hueDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

describe("roundness", () => {
  it("flattens finite radii at 0", () => {
    const flat = tokens({ round: 0 });

    expect(flat["--radius-lg"]).toBe("0px");
    expect(flat["--radius-xs"]).toBe("0px");
  });

  it("multiplies finite radii", () => {
    expect(tokens({ round: 1.5 })["--radius-lg"]).toBe("18px");
    expect(tokens({ round: 2 })["--radius-md"]).toBe("16px");
  });

  it("keeps zero and pill geometry fixed", () => {
    expect(scaleRadius("0px", 2)).toBe("0px");
    expect(scaleRadius("9999px", 2)).toBe("9999px");
    expect(scaleRadius("12px", 2)).toBe("24px");
  });
});

describe("motion speed", () => {
  it("halves durations at 2x, entrance timings included", () => {
    const fast = tokens({ speed: 2 });

    expect(fast["--duration-medium-5"]).toBe("150ms");
    expect(fast["--duration-ambient-1"]).toBe("8s");
    expect(fast["--rise-duration"]).toBe("190ms");
  });

  it("quadruples durations at the speed floor", () => {
    expect(tokens({ speed: 0.25 })["--duration-medium-5"]).toBe("1200ms");
  });

  it("never divides by zero or emits NaN, Infinity or zero durations", () => {
    for (const speed of [0.25, 0, -1]) {
      const scaled = derive({ ...DEFAULT_PARAMS, speed }, 1 / 3);

      expect(scaled["--duration-medium-5"]).toBe("1200ms");

      for (const [name, value] of Object.entries(scaled)) {
        expect(value, name).not.toContain("NaN");
        expect(value, name).not.toContain("Infinity");

        if (name.startsWith("--duration-")) {
          expect(Number.parseFloat(value), name).toBeGreaterThan(0);
        }
      }
    }

    // Unparseable values fall back to the default speed, not the floor.
    for (const speed of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        derive({ ...DEFAULT_PARAMS, speed }, 1 / 3)["--duration-medium-5"],
      ).toBe("300ms");
    }
  });
});

describe("hue rotation", () => {
  it("rotates chromatic colours and leaves neutrals byte-identical", () => {
    const base = tokens({});
    const rotated = tokens({ hue: 90 });

    expect(rotated["--palette-blue-600"]).not.toBe(base["--palette-blue-600"]);
    expect(rotated["--palette-neutral-450"]).toBe(
      base["--palette-neutral-450"],
    );
    expect(rotated["--palette-black-a8"]).toBe(base["--palette-black-a8"]);
    expect(rotated["--horizon-ring-glow"]).not.toBe(
      base["--horizon-ring-glow"],
    );
    expect(rotated["--orb-gradient"]).not.toBe(base["--orb-gradient"]);
  });

  it("weights rotation by OKLCH chroma", () => {
    const appliedRotation = (chroma: number) => {
      const input = toCss(fromOklch({ l: 0.6, c: chroma, h: 200, a: 1 }));
      const output = rotateTokenColour(input, 90);

      return Math.abs(hueDelta(hueOf(output), hueOf(input)));
    };

    // Below 0.01 the weight is zero, so the token is returned untouched.
    expect(appliedRotation(0.005)).toBe(0);
    expect(Math.abs(appliedRotation(0.04) - 90)).toBeLessThan(0.5);
    expect(Math.abs(appliedRotation(0.02) - 45)).toBeLessThanOrEqual(2);

    let previous = -1;

    for (let chroma = 0.005; chroma <= 0.0400001; chroma += 0.0025) {
      const applied = appliedRotation(chroma);

      expect(applied).toBeGreaterThanOrEqual(previous - 0.75);
      previous = applied;
    }
  });
});

describe("time of day", () => {
  it("blends primary lightness between Dawn and Day at 1/6", () => {
    const dawn = toOklch(parseColor(tokens({}, 0)["--primary"])).l;
    const day = toOklch(parseColor(tokens({}, 1 / 3)["--primary"])).l;
    const mid = toOklch(parseColor(tokens({}, 1 / 6)["--primary"])).l;

    expect(mid).toBeGreaterThan(Math.min(dawn, day));
    expect(mid).toBeLessThan(Math.max(dawn, day));
  });

  it("flips to night only past the Dusk→Night midpoint", () => {
    expect(phaseAtTod(0.83)).toBe("dusk");
    expect(phaseAtTod(0.84)).toBe("night");
    expect(phaseAtTod(0)).toBe("dawn");
    expect(phaseAtTod(1 / 3)).toBe("day");
    expect(phaseAtTod(2 / 3)).toBe("dusk");
    expect(phaseAtTod(1)).toBe("night");
  });
});

describe("contrast", () => {
  it("scales surface and on-* lightness", () => {
    const low = tokens({ contrast: CONTRAST_MIN });
    const high = tokens({ contrast: CONTRAST_MAX });

    expect(low["--on-surface"]).not.toBe(high["--on-surface"]);
    expect(low["--surface-container-low"]).not.toBe(
      high["--surface-container-low"],
    );
  });
});

describe("output format", () => {
  it("emits only hex/rgba colours, never oklch, color-mix or relative syntax", () => {
    const combined = tokens(
      { hue: 33, round: 1.1, contrast: 1.2, speed: 1.3 },
      0.42,
    );

    for (const [name, value] of Object.entries(combined)) {
      expect(value, name).not.toContain("oklch(");
      expect(value, name).not.toContain("color-mix");
      expect(value, name).not.toContain("from ");

      for (const match of value.match(COLOUR_TOKENS) ?? []) {
        expect(match, name).toMatch(ALLOWED_COLOUR);
      }
    }
  });

  it("clamps colours after hue and contrast extremes without NaN", () => {
    for (const hue of [-180, -90, 0, 90, 180]) {
      for (const contrast of [CONTRAST_MIN, CONTRAST_MAX]) {
        for (const tod of [0, 1 / 6, 0.5, 5 / 6, 1]) {
          const combined = derive({ ...DEFAULT_PARAMS, hue, contrast }, tod);

          for (const [name, value] of Object.entries(combined)) {
            for (const match of value.match(COLOUR_TOKENS) ?? []) {
              const colour = parseColor(match);

              for (const channel of [colour.r, colour.g, colour.b]) {
                expect(Number.isFinite(channel), `${name} ${match}`).toBe(true);
                expect(channel).toBeGreaterThanOrEqual(0);
                expect(channel).toBeLessThanOrEqual(255.0001);
              }

              expect(colour.a).toBeGreaterThanOrEqual(0);
              expect(colour.a).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });
});
