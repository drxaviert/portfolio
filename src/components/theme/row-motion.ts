/**
 * Dev-only enter/exit motion options for the Day-phase row.
 *
 * 0 is the shipped transition. The choice is applied as `data-row-motion` on
 * <html> so the CSS can switch the row's transitions without remounting it.
 */
export const ROW_MOTION_STORAGE_KEY = "theme-row-motion";

export const ROW_MOTIONS = [
  { value: 0, label: "0 · Current" },
  { value: 1, label: "1 · Fade + rise" },
  { value: 2, label: "2 · Popover scale" },
  { value: 3, label: "3 · Soft blur" },
  { value: 4, label: "4 · Clip unfold" },
  { value: 5, label: "5 · Staggered segments" },
] as const;

export type RowMotion = (typeof ROW_MOTIONS)[number]["value"];

/** Accepts 0-5 from storage or the select; anything else falls back to 0. */
export function parseRowMotion(value: unknown): RowMotion {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5
    ? (parsed as RowMotion)
    : 0;
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
