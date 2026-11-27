import { describe, expect, it } from "vitest";
import {
  REST_REACTIVITY,
  SHOOTING_MIN_GAP,
  SKY_PHASE_PRESET,
  SKY_TUNING_DEFAULTS,
  STAR_POOL_SIZE,
  edgeSoften,
  createStarPool,
  edgeBlurAt,
  mapBands,
  maskGradient,
  nextShootingGap,
  parsePhase,
  parseSkyTuning,
  resolvePhase,
  starCount,
  twinkle,
} from "./cosmic-sky";

describe("phase mapping", () => {
  it("shows stars at night, aurora by day, and 60% of one at the edges", () => {
    expect(SKY_PHASE_PRESET.night).toEqual({ stars: 1, aurora: 0 });
    expect(SKY_PHASE_PRESET.day.stars).toBe(0);
    expect(SKY_PHASE_PRESET.day.aurora).toBeGreaterThan(0);
    expect(SKY_PHASE_PRESET.dusk.stars).toBeGreaterThan(0);
    expect(SKY_PHASE_PRESET.dusk.aurora).toBeGreaterThan(0);
    expect(SKY_PHASE_PRESET.dawn).toEqual({ stars: 0, aurora: 0.6 });
  });

  it("parses unknown phases as day and honours the override", () => {
    expect(parsePhase(undefined)).toBe("day");
    expect(parsePhase("night")).toBe("night");
    expect(resolvePhase("day", "auto")).toBe("day");
    expect(resolvePhase("day", "night")).toBe("night");
  });
});

describe("band mapping", () => {
  const zero = { bass: 0, mid: 0, high: 0, energy: 0 };

  it("is the resting look when every band is 0", () => {
    expect(mapBands(zero, SKY_TUNING_DEFAULTS)).toEqual(REST_REACTIVITY);
  });

  it("routes energy to lift, mid to twinkle and glow, bass to sway", () => {
    const energy = mapBands({ ...zero, energy: 1 }, SKY_TUNING_DEFAULTS);
    const mid = mapBands({ ...zero, mid: 1 }, SKY_TUNING_DEFAULTS);
    const bass = mapBands({ ...zero, bass: 1 }, SKY_TUNING_DEFAULTS);

    expect(energy.lift).toBeGreaterThan(1);
    expect(energy.sway).toBe(1);
    expect(mid.twinkleDepth).toBeGreaterThan(REST_REACTIVITY.twinkleDepth);
    expect(mid.auroraBright).toBeGreaterThan(1);
    expect(bass.sway).toBeGreaterThan(1);
    expect(bass.auroraBright).toBe(1);
  });

  it("applies the gains, so a zero gain switches a band off", () => {
    const off = { ...SKY_TUNING_DEFAULTS, gainBass: 0 };

    expect(mapBands({ ...zero, bass: 1 }, off).sway).toBe(1);
  });

  it("lifts a near-silent high band so it still registers", () => {
    const reacted = mapBands({ ...zero, high: 0.05 }, SKY_TUNING_DEFAULTS);

    expect(reacted.shimmer).toBeCloseTo(0.15);
  });
});

describe("stars", () => {
  it("builds the same pool every time, in three depth layers", () => {
    const pool = createStarPool();

    expect(pool).toHaveLength(STAR_POOL_SIZE);
    expect(createStarPool()).toEqual(pool);
    expect(new Set(pool.map((star) => star.layer))).toEqual(new Set([0, 1, 2]));
  });

  it("keeps every star sparse, tiny and on a 4-9s twinkle", () => {
    for (const star of createStarPool()) {
      expect(star.radius).toBeLessThan(1.3);
      expect(star.baseAlpha).toBeLessThanOrEqual(0.7);
      expect(star.period).toBeGreaterThanOrEqual(4);
      expect(star.period).toBeLessThanOrEqual(9);
    }
  });

  it("scales the count with the area and density, within the pool", () => {
    expect(starCount(1440, 450, 1)).toBeGreaterThan(40);
    expect(starCount(1440, 450, 1)).toBeLessThan(120);
    expect(starCount(720, 450, 1)).toBeLessThan(starCount(1440, 450, 1));
    expect(starCount(1440, 450, 0)).toBe(0);
    expect(starCount(9000, 9000, 2.5)).toBe(STAR_POOL_SIZE);
  });

  it("twinkles between full and (1 - depth)", () => {
    const [star] = createStarPool();
    const values = Array.from({ length: 200 }, (_, i) =>
      twinkle(star, i * 0.1, 0.4),
    );

    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.3);
  });

  it("spaces shooting stars at least 40s apart", () => {
    expect(nextShootingGap(() => 0)).toBe(SHOOTING_MIN_GAP);
    expect(nextShootingGap(() => 0.99)).toBeGreaterThan(SHOOTING_MIN_GAP);
  });
});

describe("edge blur compensation", () => {
  const edge = { height: 400, max: 32 };

  it("follows the edge blur: full at the top edge, none past the band", () => {
    expect(edgeBlurAt(0, edge)).toBe(32);
    expect(edgeBlurAt(200, edge)).toBeCloseTo(8);
    expect(edgeBlurAt(400, edge)).toBe(0);
    expect(edgeBlurAt(500, edge)).toBe(0);
    expect(edgeBlurAt(0, { height: 0, max: 8 })).toBe(0);
  });

  it("only lightly eases stars toward the very top edge", () => {
    expect(edgeSoften(0, 32)).toEqual({ alpha: 1, soften: 0 });
    expect(edgeSoften(32, 32).alpha).toBeCloseTo(0.7);
    expect(edgeSoften(32, 32).soften).toBeLessThanOrEqual(0.5);
    expect(edgeSoften(5, 0)).toEqual({ alpha: 1, soften: 0 });
  });
});

describe("settings", () => {
  it("falls back to defaults on bad storage and clamps numbers", () => {
    expect(parseSkyTuning(null)).toEqual(SKY_TUNING_DEFAULTS);
    expect(parseSkyTuning("nope")).toEqual(SKY_TUNING_DEFAULTS);

    const parsed = parseSkyTuning(
      JSON.stringify({ starDensity: 99, phaseOverride: "dusk", gainMid: "x" }),
    );

    expect(parsed.starDensity).toBe(8);
    expect(parsed.phaseOverride).toBe("dusk");
    expect(parsed.gainMid).toBe(SKY_TUNING_DEFAULTS.gainMid);
  });

  it("builds an eased top-to-bottom mask that ends fully clear", () => {
    const mask = maskGradient();

    expect(mask).toContain("rgba(0,0,0,1.000) 0%");
    expect(mask).toContain("rgba(0,0,0,0.000) 100%");
  });
});
