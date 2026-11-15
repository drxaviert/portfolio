import { describe, expect, it } from "vitest";
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

/** The palette hexes sampled below all come from `src/app/globals.css`. */
const SAMPLED_PALETTE_HEXES = [
  "#ffffff",
  "#f2f1f0",
  "#e5e5e5",
  "#999999",
  "#4c4c4c",
  "#262626",
  "#0d0d0d",
  "#000000",
  "#f3f8fc",
  "#e5edf6",
  "#aed0ed",
  "#60a8e2",
  "#0071c1",
  "#fdfbff",
  "#edd8fc",
  "#6670e0",
  "#f2a0c8",
  "#f73131",
  "#ffe97a",
  "#8fc3c9",
];

function hexToRgba(hex: string): Rgba {
  const value = Number.parseInt(hex.slice(1), 16);

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
    a: 1,
  };
}

function hueDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

describe("parseColor", () => {
  it("parses modern rgb() space syntax with a slash alpha", () => {
    expect(parseColor("rgb(0 0 0 / 0.08)")).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0.08,
    });
  });

  it("parses comma rgba() syntax", () => {
    expect(parseColor("rgba(255, 128, 0, 0.5)")).toEqual({
      r: 255,
      g: 128,
      b: 0,
      a: 0.5,
    });
  });

  it("parses #rgb, #rrggbb and #rrggbbaa", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#60a8e2")).toEqual({
      r: 0x60,
      g: 0xa8,
      b: 0xe2,
      a: 1,
    });
    expect(parseColor("#60a8e280")).toEqual({
      r: 0x60,
      g: 0xa8,
      b: 0xe2,
      a: 128 / 255,
    });
  });

  it("parses oklch() through the CSS Color 4 reference matrices", () => {
    // 89% 0.0138 247.97 is in gamut and resolves to #d4dce4.
    const parsed = parseColor("oklch(89% 0.0138 247.97)");

    expect(Math.abs(parsed.r - 0xd4)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed.g - 0xdc)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed.b - 0xe4)).toBeLessThanOrEqual(1);
    expect(parsed.a).toBe(1);
    expect(Math.abs(hueDelta(toOklch(parsed).h, 247.97))).toBeLessThan(1);
  });

  it("throws on anything that is not a supported colour", () => {
    for (const value of [
      "",
      "blue",
      "hsl(200 50% 50%)",
      "rgb(1 2)",
      "oklch(89% 0.0138)",
      "#ff",
      "var(--palette-blue-600)",
    ]) {
      expect(() => parseColor(value)).toThrow();
    }
  });
});

describe("OKLCH round trip", () => {
  it("returns every sampled palette hex within one 8-bit step per channel", () => {
    for (const hex of SAMPLED_PALETTE_HEXES) {
      const source = hexToRgba(hex);
      const roundTripped = fromOklch(toOklch(source));

      expect(Math.abs(roundTripped.r - source.r), hex).toBeLessThanOrEqual(1);
      expect(Math.abs(roundTripped.g - source.g), hex).toBeLessThanOrEqual(1);
      expect(Math.abs(roundTripped.b - source.b), hex).toBeLessThanOrEqual(1);
      expect(roundTripped.a).toBe(1);
    }
  });
});

describe("blendOklch", () => {
  it("takes the shortest hue arc from red to blue", () => {
    const red = toOklch(parseColor("#ff0000"));
    const blue = toOklch(parseColor("#0000ff"));
    const mix = blendOklch(red, blue, 0.5);
    const shortestDelta = hueDelta(blue.h, red.h);

    expect(Math.abs(hueDelta(mix.h, red.h + shortestDelta * 0.5))).toBeLessThan(
      0.5,
    );
    // The short way round is the backwards one: red -> magenta -> blue.
    expect(Math.abs(hueDelta(mix.h, red.h))).toBeLessThan(180);
  });

  it("takes the hue of the chromatic side when one side is achromatic", () => {
    const grey = { l: 0.5, c: 0, h: 0, a: 1 };
    const teal = { l: 0.7, c: 0.1, h: 190, a: 1 };

    expect(blendOklch(grey, teal, 0.5).h).toBeCloseTo(190, 5);
    expect(blendOklch(teal, grey, 0.5).h).toBeCloseTo(190, 5);
  });
});

describe("rotateHue", () => {
  const base = { l: 0.6, c: 0.02, h: 200, a: 1 };

  it("leaves near-neutrals alone", () => {
    expect(rotateHue({ ...base, c: 0.005 }, 90).h).toBeCloseTo(200, 5);
  });

  it("moves chromatic colours the full amount", () => {
    expect(rotateHue({ ...base, c: 0.04 }, 90).h).toBeCloseTo(290, 5);
  });

  it("moves mid-chroma colours about half way", () => {
    expect(rotateHue(base, 90).h).toBeCloseTo(245, 0);
    expect(Math.abs(hueDelta(rotateHue(base, 90).h, 245))).toBeLessThanOrEqual(
      2,
    );
  });

  it("is monotonic across the smoothstep ramp", () => {
    let previous = -1;

    for (let c = 0.005; c <= 0.04 + 1e-9; c += 0.0025) {
      const applied = Math.abs(hueDelta(rotateHue({ ...base, c }, 90).h, 200));

      expect(applied).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = applied;
    }
  });
});

describe("fromOklch", () => {
  it("gamut-clamps out-of-range colours without NaN or hue drift", () => {
    const clamped = fromOklch({ l: 0.7, c: 0.4, h: 140, a: 1 });

    for (const channel of [clamped.r, clamped.g, clamped.b]) {
      expect(Number.isFinite(channel)).toBe(true);
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }

    expect(Math.abs(hueDelta(toOklch(clamped).h, 140))).toBeLessThan(2);
  });
});

describe("toCss", () => {
  it("writes opaque colours as lowercase hex", () => {
    expect(toCss({ r: 212, g: 220, b: 228, a: 1 })).toBe("#d4dce4");
  });

  it("writes translucent colours as rgba() with two decimal places", () => {
    expect(toCss({ r: 255, g: 255, b: 255, a: 0.08 })).toBe(
      "rgba(255, 255, 255, 0.08)",
    );
  });
});

describe("contrastRatio", () => {
  it("scores black on white at 21", () => {
    expect(
      contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }),
    ).toBeCloseTo(21, 5);
  });

  it("scores a colour against itself at 1", () => {
    const grey = { r: 0x77, g: 0x77, b: 0x77, a: 1 };

    expect(contrastRatio(grey, grey)).toBeCloseTo(1, 5);
  });

  it("composites a translucent foreground over the background", () => {
    const halfBlack = { r: 0, g: 0, b: 0, a: 0.5 };
    const white = { r: 255, g: 255, b: 255, a: 1 };

    // 50% black over white is #808080, whose WCAG ratio against white is
    // about 3.95:1.
    expect(contrastRatio(halfBlack, white)).toBeGreaterThan(3.9);
    expect(contrastRatio(halfBlack, white)).toBeLessThan(4);
  });
});
