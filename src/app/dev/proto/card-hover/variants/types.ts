import type { ComponentType } from "react";

export type Values = Record<string, string | number>;

export type Control = {
  key: string;
  label: string;
  kind: "range" | "select";
  /** Custom property written on the stage root. Omit for non-CSS controls. */
  cssVar?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  /** Value as written to the CSS custom property. */
  toCss: (value: string | number, all: Values) => string;
  /** Value as shown next to the control (the effective number). */
  format: (value: string | number, all: Values) => string;
};

export type Variant = {
  id: string;
  name: string;
  /** One line naming the axis, shown under the panel title. */
  axis: string;
  css: string;
  defaults: Values;
  controls: Control[];
  Stage: ComponentType;
};

/** Named curves from the emil-animations library, strongest first. */
export const EASE_OPTIONS = [
  { label: "ease-out quint", value: "cubic-bezier(0.23, 1, 0.32, 1)" },
  { label: "ease-out quart", value: "cubic-bezier(0.165, 0.84, 0.44, 1)" },
  { label: "ease-out expo", value: "cubic-bezier(0.19, 1, 0.22, 1)" },
  { label: "soft ease-out", value: "cubic-bezier(0.32, 0.72, 0, 1)" },
  { label: "ease-in-out quart", value: "cubic-bezier(0.77, 0, 0.175, 1)" },
  { label: "ease", value: "ease" },
];

export const SPEED_OPTIONS = [
  { label: "1×", value: "1" },
  { label: "0.5×", value: "0.5" },
  { label: "0.25×", value: "0.25" },
];

/** Duration, multiplied by the speed control. Shared shape across variants. */
export function durationControl(label: string): Control {
  return {
    key: "duration",
    label,
    kind: "range",
    min: 60,
    max: 400,
    step: 10,
    cssVar: "--ch-dur",
    toCss: (value, all) => `${Math.round(Number(value) * Number(all.speed))}ms`,
    format: (value, all) => `${Math.round(Number(value) * Number(all.speed))}ms`,
  };
}

export const easeControl: Control = {
  key: "ease",
  label: "Easing",
  kind: "select",
  options: EASE_OPTIONS,
  cssVar: "--ch-ease",
  toCss: (value) => String(value),
  format: (value) => String(value).replace("cubic-bezier", ""),
};

export const speedControl: Control = {
  key: "speed",
  label: "Speed",
  kind: "select",
  options: SPEED_OPTIONS,
  toCss: (value) => String(value),
  format: (value) => `${value}×`,
};

/** 0–1 slider shown as a percentage. */
export function percentControl(
  key: string,
  label: string,
  cssVar: string,
): Control {
  return {
    key,
    label,
    kind: "range",
    min: 0,
    max: 1,
    step: 0.05,
    cssVar,
    toCss: (v) => String(v),
    format: (v) => `${Math.round(Number(v) * 100)}%`,
  };
}

/** Milliseconds, multiplied by the speed control. */
export function msControl(
  key: string,
  label: string,
  cssVar: string,
  min: number,
  max: number,
  step = 10,
): Control {
  return {
    key,
    label,
    kind: "range",
    min,
    max,
    step,
    cssVar,
    toCss: (value, all) => `${Math.round(Number(value) * Number(all.speed))}ms`,
    format: (value, all) => `${Math.round(Number(value) * Number(all.speed))}ms`,
  };
}

/** Pixels, one decimal place at most. */
export function pxControl(
  key: string,
  label: string,
  cssVar: string,
  min: number,
  max: number,
  step = 0.5,
): Control {
  return {
    key,
    label,
    kind: "range",
    min,
    max,
    step,
    cssVar,
    toCss: (value) => `${value}px`,
    format: (value) => `${value}px`,
  };
}

/** Which gradient lights the ring: the phase accent pair, or the horizon. */
export const glowSourceControl: Control = {
  key: "source",
  label: "Glow source",
  kind: "select",
  options: [
    { label: "orb gradient", value: "orb" },
    { label: "horizon", value: "horizon" },
  ],
  cssVar: "--ch-glow-image",
  toCss: (value) =>
    value === "horizon" ? "var(--ch-horizon-glow)" : "var(--orb-gradient)",
  format: (value) => String(value),
};

/** Alpha boost applied to the horizon hues so they survive on a 1px ring. */
export const horizonBoostControl: Control = {
  key: "boost",
  label: "Horizon boost",
  kind: "range",
  min: 10,
  max: 100,
  step: 5,
  cssVar: "--ch-boost",
  toCss: (value) => `${value}%`,
  format: (value) => `${value}%`,
};
