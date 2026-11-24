import { describe, expect, it } from "vitest";
import { FILM_LIGHTING } from "./lighting";
import type {
  DirectionalLightSpec,
  HemisphereLightSpec,
} from "./lighting";

function channels(color: number) {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

describe("neutral film lighting", () => {
  const directional = FILM_LIGHTING.lights.filter(
    (light): light is DirectionalLightSpec => light.type === "directional",
  );
  const key = directional.find(
    (light) => light.position[0] < -100 && light.position[2] > 0,
  );
  const rim = directional.find((light) => light.position[2] < -100);
  const fill = directional.find(
    (light) => light.position[0] > 100 && light.position[1] < 0,
  );
  const hemisphere = FILM_LIGHTING.lights.find(
    (light): light is HemisphereLightSpec => light.type === "hemisphere",
  );

  it("uses a pure-white key", () => {
    expect(key?.color).toBe(0xffffff);
  });

  it("keeps the rim neutral or barely cool", () => {
    expect(rim).toBeDefined();

    const { r, g, b } = channels(rim!.color);

    expect(b - r).toBeLessThanOrEqual(10);
    expect(g - r).toBeLessThanOrEqual(4);
    expect(b - g).toBeLessThanOrEqual(8);
  });

  it("uses a neutral fill and a low neutral hemisphere", () => {
    expect(fill).toBeDefined();

    const { r, g, b } = channels(fill!.color);

    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
    expect(hemisphere?.sky).toBe(0xffffff);
    expect(hemisphere?.intensity).toBeLessThanOrEqual(0.1);
  });

  it("keeps the film shadows dense and soft", () => {
    expect(FILM_LIGHTING.shadowOpacity).toBeGreaterThan(0.5);
    expect(FILM_LIGHTING.shadowScale).toBeGreaterThanOrEqual(1);
  });
});
