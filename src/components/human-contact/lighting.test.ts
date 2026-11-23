import { describe, expect, it } from "vitest";
import { LIGHTING_PRESETS } from "./lighting";
import type { DirectionalLightSpec, SpotLightSpec } from "./lighting";

const LAB = ["key-rim", "spotlight", "film"] as const;

describe("lighting presets", () => {
  it("defines the shipped current preset and the three lab presets", () => {
    expect(Object.keys(LIGHTING_PRESETS).sort()).toEqual([
      "current",
      "film",
      "key-rim",
      "spotlight",
    ]);
  });

  it("keeps the lab ambient and hemisphere fill very low", () => {
    for (const key of LAB) {
      const hemisphere = LIGHTING_PRESETS[key].lights.filter(
        (light) => light.type === "hemisphere",
      );

      expect(hemisphere.length).toBeLessThanOrEqual(1);

      for (const light of hemisphere) {
        expect(light.intensity).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("gives key-rim and film a key and a back rim", () => {
    for (const key of ["key-rim", "film"] as const) {
      const directional = LIGHTING_PRESETS[key].lights.filter(
        (light): light is DirectionalLightSpec =>
          light.type === "directional",
      );

      expect(
        directional.some(
          (light) => light.position[0] < -100 && light.position[2] > 0,
        ),
      ).toBe(true);
      expect(
        directional.some((light) => light.position[2] < -100),
      ).toBe(true);
    }
  });

  it("uses one soft overhead spot for the pool", () => {
    const spots = LIGHTING_PRESETS.spotlight.lights.filter(
      (light): light is SpotLightSpec => light.type === "spot",
    );

    expect(spots).toHaveLength(1);
    expect(spots[0].penumbra).toBeGreaterThanOrEqual(0.8);
    expect(spots[0].angle).toBeGreaterThan(0.2);
    expect(spots[0].angle).toBeLessThan(0.45);
    expect(spots[0].decay).toBe(0);
  });

  it("keeps the lab shadows denser than the shipped preset", () => {
    for (const key of LAB) {
      expect(LIGHTING_PRESETS[key].shadowOpacity).toBeGreaterThan(
        LIGHTING_PRESETS.current.shadowOpacity,
      );
    }

    expect(LIGHTING_PRESETS.current.exposure).toBe(1.1);
  });
});
