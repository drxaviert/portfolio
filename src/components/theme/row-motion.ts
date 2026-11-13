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
  { value: 0, label: "0 · Current" },
  { value: 1, label: "1 · Fade + rise" },
  { value: 2, label: "2 · Popover scale" },
  { value: 3, label: "3 · Soft blur" },
  { value: 4, label: "4 · Clip unfold" },
  { value: 5, label: "5 · Staggered segments" },
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
};

export const ROW_SPEED_MIN = 0.25;
export const ROW_SPEED_MAX = 4;
export const ROW_SPEED_STEP = 0.05;
export const ROW_SPEED_DEFAULT = 1;

export type RowSpeeds = Partial<Record<RowMotion, number>>;

/** Accepts 0-5 from storage or the select; anything else falls back to 0. */
export function parseRowMotion(value: unknown): RowMotion {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5
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

    if (Number.isInteger(motion) && motion >= 0 && motion <= 5) {
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
