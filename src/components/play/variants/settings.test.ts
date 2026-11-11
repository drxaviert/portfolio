import { describe, expect, it } from "vitest";
import {
  createVariantDefaults,
  VARIANTS,
  VARIANT_SLIDERS,
} from "@/components/play/variants/settings";

describe("play card variant settings", () => {
  it("exposes five variants with unique shortcuts", () => {
    expect(VARIANTS).toHaveLength(5);
    expect(new Set(VARIANTS.map((entry) => entry.shortcut)).size).toBe(5);
  });

  it("keeps every default inside its slider range", () => {
    const defaults = createVariantDefaults();

    for (const entry of VARIANTS) {
      const values = defaults[entry.id] as unknown as Record<string, number>;

      for (const slider of VARIANT_SLIDERS[entry.id]) {
        expect(values[slider.key], `${entry.id}.${slider.key}`).toBeDefined();
        expect(values[slider.key]).toBeGreaterThanOrEqual(slider.min);
        expect(values[slider.key]).toBeLessThanOrEqual(slider.max);
      }
    }
  });

  it("keeps the reference density ranges", () => {
    const defaults = createVariantDefaults();

    expect(defaults.faithful.strandCount).toBeGreaterThanOrEqual(400);
    expect(defaults.faithful.strandCount).toBeLessThanOrEqual(700);
    expect(defaults["fibre-lamp"].strandCount).toBeGreaterThanOrEqual(150);
    expect(defaults["fibre-lamp"].strandCount).toBeLessThanOrEqual(250);
  });
});
