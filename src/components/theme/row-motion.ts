/**
 * Dev-only enter/exit motion options for the Day-phase row.
 *
 * 0 is the shipped transition. The choice is applied as `data-row-motion` on
 * <html> so the CSS can switch the row's transitions without remounting it.
 * Each option also remembers its own speed multiplier.
 */
export const ROW_MOTION_STORAGE_KEY = "theme-row-motion";
export const ROW_MOTION_SPEED_STORAGE_KEY = "theme-row-motion-speed";

export const ROW_MOTIONS = [
  { value: 0, label: "0 \u00B7 Current" },
  { value: 1, label: "1 \u00B7 Fade + rise" },
  { value: 2, label: "2 \u00B7 Popover scale" },
  { value: 3, label: "3 \u00B7 Soft blur" },
  { value: 4, label: "4 \u00B7 Clip unfold" },
  { value: 5, label: "5 \u00B7 Staggered segments" },
  { value: 6, label: "6 \u00B7 Stagger + icons" },
] as const;

export type RowMotion = (typeof ROW_MOTIONS)[number]["value"];

/**
 * Base enter/exit times in ms, mirroring theme-toggle.css. The dev readout
 * uses these to show the scaled duration for the selected option.
 */
export const ROW_MOTION_DURATIONS: Record<
  RowMotion,
  { enter: number; exit: number }
> = {
  0: { enter: 180, exit: 120 },
  1: { enter: 180, exit: 120 },
  2: { enter: 200, exit: 140 },
  3: { enter: 220, exit: 140 },
  4: { enter: 220, exit: 150 },
  5: { enter: 200, exit: 120 },
  6: { enter: 200, exit: 120 },
};

export const ROW_SPEED_MIN = 0.25;
export const ROW_SPEED_MAX = 4;
export const ROW_SPEED_STEP = 0.05;
export const ROW_SPEED_DEFAULT = 1;

export type RowSpeeds = Partial<Record<RowMotion, number>>;

/** Accepts 0-6 from storage or the select; anything else falls back to 0. */
export function parseRowMotion(value: unknown): RowMotion {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6
    ? (parsed as RowMotion)
    : 0;
}

/** Clamps to the slider range and quantises to its step. */
export function parseRowSpeed(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return ROW_SPEED_DEFAULT;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return ROW_SPEED_DEFAULT;
  }

  const clamped = Math.min(ROW_SPEED_MAX, Math.max(ROW_SPEED_MIN, parsed));

  return Number(
    (Math.round(clamped / ROW_SPEED_STEP) * ROW_SPEED_STEP).toFixed(2),
  );
}

/** Reads the remembered motion; blocked storage means the current behavior. */
export function readRowMotion(): RowMotion {
  try {
    return parseRowMotion(window.localStorage.getItem(ROW_MOTION_STORAGE_KEY));
  } catch {
    return 0;
  }
}

/** Persists the motion; a failed write must not break the page. */
export function writeRowMotion(motion: RowMotion): void {
  try {
    window.localStorage.setItem(ROW_MOTION_STORAGE_KEY, String(motion));
  } catch {
    // Intentionally ignored: the current page keeps the chosen motion.
  }
}

/** Parses the option -> speed JSON map, dropping unknown or invalid entries. */
export function parseRowMotionSpeeds(value: unknown): RowSpeeds {
  if (typeof value !== "string") {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const speeds: RowSpeeds = {};

  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const motion = Number(key);

    if (Number.isInteger(motion) && motion >= 0 && motion <= 6) {
      speeds[motion as RowMotion] = parseRowSpeed(raw);
    }
  }

  return speeds;
}

/** Reads the per-option speed map; blocked or malformed storage is empty. */
export function readRowMotionSpeeds(): RowSpeeds {
  try {
    return parseRowMotionSpeeds(
      window.localStorage.getItem(ROW_MOTION_SPEED_STORAGE_KEY),
    );
  } catch {
    return {};
  }
}

/** Persists the per-option speed map; a failed write is ignored. */
export function writeRowMotionSpeeds(speeds: RowSpeeds): void {
  try {
    window.localStorage.setItem(
      ROW_MOTION_SPEED_STORAGE_KEY,
      JSON.stringify(speeds),
    );
  } catch {
    // Intentionally ignored: the current page keeps the chosen speeds.
  }
}

/** The dev readout, e.g. 1.50x - enter 300ms / exit 210ms. */
export function formatSpeedReadout(motion: RowMotion, speed: number): string {
  const durations = ROW_MOTION_DURATIONS[motion];

  return `${speed.toFixed(2)}x - enter ${Math.round(
    durations.enter * speed,
  )}ms / exit ${Math.round(durations.exit * speed)}ms`;
}

export const ROW_MOTION_ICON_STORAGE_KEY = "theme-row-motion-icon";
export const ICON_STRENGTH_MIN = 0.5;
export const ICON_STRENGTH_MAX = 3;
export const ICON_STRENGTH_STEP = 0.1;
export const ICON_STRENGTH_DEFAULT = 1;

/** Base option-6 pose offsets; the strength multiplier scales these. */
export const ICON_BASE_RAYS_DEG = 45;
export const ICON_BASE_RISE_PX = 4;
export const ICON_BASE_SCALE_OFFSET = 0.15;

export type RowIconStrengths = Partial<Record<RowMotion, number>>;

/** Clamps to 0.5x-3x and quantises to the 0.1 step. */
export function parseIconStrength(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return ICON_STRENGTH_DEFAULT;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return ICON_STRENGTH_DEFAULT;
  }

  const clamped = Math.min(
    ICON_STRENGTH_MAX,
    Math.max(ICON_STRENGTH_MIN, parsed),
  );

  return Number(
    (
      Math.round(clamped / ICON_STRENGTH_STEP) * ICON_STRENGTH_STEP
    ).toFixed(2),
  );
}

/** Parses the option -> icon-strength JSON map, dropping unknown entries. */
export function parseRowIconStrengths(value: unknown): RowIconStrengths {
  if (typeof value !== "string") {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const strengths: RowIconStrengths = {};

  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const motion = Number(key);

    if (Number.isInteger(motion) && motion >= 0 && motion <= 6) {
      strengths[motion as RowMotion] = parseIconStrength(raw);
    }
  }

  return strengths;
}

/** Reads the per-option icon-strength map; blocked/malformed storage is empty. */
export function readRowIconStrengths(): RowIconStrengths {
  try {
    return parseRowIconStrengths(
      window.localStorage.getItem(ROW_MOTION_ICON_STORAGE_KEY),
    );
  } catch {
    return {};
  }
}

/** Persists the per-option icon-strength map; a failed write is ignored. */
export function writeRowIconStrengths(strengths: RowIconStrengths): void {
  try {
    window.localStorage.setItem(
      ROW_MOTION_ICON_STORAGE_KEY,
      JSON.stringify(strengths),
    );
  } catch {
    // Intentionally ignored: the current page keeps the chosen strengths.
  }
}

/** The dev readout, e.g. 1.5x - rays -68deg / rise 6px. */
export function formatIconStrengthReadout(strength: number): string {
  return `${Number(strength.toFixed(2))}x - rays -${Math.round(
    ICON_BASE_RAYS_DEG * strength,
  )}deg / rise ${Math.round(ICON_BASE_RISE_PX * strength)}px`;
}

/** How long the row survives after the pointer leaves in the dev picker. */
export const ROW_CLOSE_STORAGE_KEY = "theme-row-close";

export type RowCloseMode = "700" | "instant";

export function parseRowCloseMode(value: unknown): RowCloseMode {
  return value === "instant" ? "instant" : "700";
}

export function readRowCloseMode(): RowCloseMode {
  try {
    return parseRowCloseMode(
      window.localStorage.getItem(ROW_CLOSE_STORAGE_KEY),
    );
  } catch {
    return "700";
  }
}

export function writeRowCloseMode(mode: RowCloseMode): void {
  try {
    window.localStorage.setItem(ROW_CLOSE_STORAGE_KEY, mode);
  } catch {
    // Intentionally ignored: the current page keeps the chosen close mode.
  }
}
