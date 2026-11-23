/**
 * Lighting presets for the Human Contact scene.
 *
 * `current` is the shipped look used by /live and /work. The three lab
 * presets are selected only on /dev/human-contact until Dat picks one. They
 * share ACES tone mapping and sRGB output; only the light rig, exposure and
 * shadow density change.
 *
 * The shipped preset is the previous rig verbatim, so the public routes do not
 * drift while the lab is open.
 */
export type LightingPreset = "current" | "key-rim" | "spotlight" | "film";

export type DirectionalLightSpec = {
  type: "directional";
  color: number;
  intensity: number;
  position: [number, number, number];
};

export type SpotLightSpec = {
  type: "spot";
  color: number;
  intensity: number;
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  penumbra: number;
  decay: number;
  distance: number;
};

export type HemisphereLightSpec = {
  type: "hemisphere";
  sky: number;
  ground: number;
  intensity: number;
};

export type LightSpec =
  | DirectionalLightSpec
  | SpotLightSpec
  | HemisphereLightSpec;

export type LightingConfig = {
  exposure: number;
  /** Absolute opacity at rest for the lift-aware blob shadow. */
  shadowOpacity: number;
  /** Multiplier on the blob's base size: denser/softer shadows. */
  shadowScale: number;
  lights: LightSpec[];
};

export const LIGHTING_PRESETS: Record<LightingPreset, LightingConfig> = {
  current: {
    exposure: 1.1,
    shadowOpacity: 0.5,
    shadowScale: 1,
    lights: [
      {
        type: "directional",
        color: 0xffffff,
        intensity: 2.4,
        position: [-140, 170, 230],
      },
      {
        type: "directional",
        color: 0xd8e0ea,
        intensity: 0.55,
        position: [160, -70, 140],
      },
      {
        type: "directional",
        color: 0xffffff,
        intensity: 0.7,
        position: [70, 180, -200],
      },
      {
        type: "hemisphere",
        sky: 0xffffff,
        ground: 0x111111,
        intensity: 0.6,
      },
    ],
  },

  "key-rim": {
    exposure: 1.04,
    shadowOpacity: 0.62,
    shadowScale: 1.06,
    lights: [
      {
        type: "directional",
        color: 0xfff1df,
        intensity: 3,
        position: [-150, 180, 240],
      },
      {
        type: "directional",
        color: 0x8fa8c8,
        intensity: 0.16,
        position: [160, -80, 120],
      },
      {
        type: "directional",
        color: 0xcfe0ff,
        intensity: 1.8,
        position: [90, 150, -220],
      },
      {
        type: "hemisphere",
        sky: 0xdbe6ff,
        ground: 0x000000,
        intensity: 0.08,
      },
    ],
  },

  spotlight: {
    exposure: 0.98,
    shadowOpacity: 0.58,
    shadowScale: 1.04,
    lights: [
      {
        type: "spot",
        color: 0xfff2e2,
        intensity: 3.2,
        position: [-70, 170, 250],
        target: [10, 0, 0],
        angle: 0.3,
        penumbra: 1,
        decay: 0,
        distance: 0,
      },
      {
        type: "hemisphere",
        sky: 0xdbe6ff,
        ground: 0x000000,
        intensity: 0.055,
      },
    ],
  },

  film: {
    exposure: 1.02,
    shadowOpacity: 0.66,
    shadowScale: 1.1,
    lights: [
      {
        type: "directional",
        color: 0xfff0dc,
        intensity: 3.4,
        position: [-150, 180, 240],
      },
      {
        type: "directional",
        color: 0x8fa8c8,
        intensity: 0.14,
        position: [160, -80, 120],
      },
      {
        type: "directional",
        color: 0xcfe0ff,
        intensity: 2,
        position: [90, 150, -220],
      },
      {
        type: "hemisphere",
        sky: 0xdbe6ff,
        ground: 0x000000,
        intensity: 0.07,
      },
    ],
  },
};
