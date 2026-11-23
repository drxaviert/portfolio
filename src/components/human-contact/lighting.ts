/**
 * The one lighting rig now: the Film look Dat picked, with the key made
 * neutral. The public routes and the dev route all use it; there are no
 * presets or query parameters left.
 *
 * The key is pure white. The fill and hemisphere are neutral grey/white. The
 * rim is a barely-cool white (B-R = 8/255) so the far edges separate without
 * reading blue on the props. ACES tone mapping and sRGB output are set on the
 * renderer.
 */
export type DirectionalLightSpec = {
  type: "directional";
  color: number;
  intensity: number;
  position: [number, number, number];
};

export type HemisphereLightSpec = {
  type: "hemisphere";
  sky: number;
  ground: number;
  intensity: number;
};

export type LightSpec = DirectionalLightSpec | HemisphereLightSpec;

export type LightingConfig = {
  exposure: number;
  /** Absolute opacity at rest for the lift-aware blob shadow. */
  shadowOpacity: number;
  /** Multiplier on the blob's base size: denser/softer shadows. */
  shadowScale: number;
  lights: LightSpec[];
};

export const FILM_LIGHTING: LightingConfig = {
  exposure: 1.02,
  shadowOpacity: 0.66,
  shadowScale: 1.1,
  lights: [
    {
      type: "directional",
      color: 0xffffff,
      intensity: 3.4,
      position: [-150, 180, 240],
    },
    {
      type: "directional",
      color: 0xd8d8d8,
      intensity: 0.14,
      position: [160, -80, 120],
    },
    {
      type: "directional",
      color: 0xf2f5fa,
      intensity: 2,
      position: [90, 150, -220],
    },
    {
      type: "hemisphere",
      sky: 0xffffff,
      ground: 0x000000,
      intensity: 0.07,
    },
  ],
};
