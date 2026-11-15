// The five source parameters and their defaults.
//
// Task 2 only needs the shape and the defaults; Task 3 adds the ranges,
// clamping and URL serialisation.

export type Params = {
  hue: number;
  round: number;
  tod: number;
  contrast: number;
  speed: number;
};

export const DEFAULT_PARAMS: Params = {
  hue: 0,
  round: 1,
  tod: 1 / 3,
  contrast: 1,
  speed: 1,
};
